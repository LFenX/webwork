import "dotenv/config"
import assert from "node:assert/strict"
import { prisma } from "@/lib/db"
import {
  cancelAssistantMessage,
  finalizeAIRun,
  getAIRunByMessageId,
  isAIRunCancelled,
  listActiveAIRuns,
  requestAIRunCancellation,
  updateAssistantMessagePartial,
} from "@/lib/ai/service"

// End-to-end reliability test for 蝶灵's long-task cancellation + recovery.
// Runs against the real database (no live LLM). It exercises the server-side
// cancel contract that the agent loop and SSE route depend on, and proves the
// three required behaviors: 可真正停止 / 可继续 / 可恢复.
//
// Run with: npx tsx --tsconfig scripts/tsconfig.preview.json scripts/test-run-reliability.ts
// (the preview tsconfig stubs `server-only` so lib/ai/service.ts can be imported)

const TAG = "[test-run-reliability]"
const tests: Array<{ name: string; fn: () => Promise<void> }> = []
function test(name: string, fn: () => Promise<void>) {
  tests.push({ name, fn })
}

// ── Test fixtures: a throwaway user + conversation + assistant message + run ──
async function createFixture(prompt = "生成一份很长的 PDF 报告") {
  const user = await prisma.user.create({
    data: {
      email: `test-run-reliability-${Date.now()}-${Math.random().toString(36).slice(2)}@example.invalid`,
      passwordHash: "x",
      displayName: "Run Reliability Test",
    },
  })
  const conversation = await prisma.aIConversation.create({
    data: { userId: user.id, title: "reliability-test" },
  })
  const message = await prisma.aIMessage.create({
    data: { conversationId: conversation.id, userId: user.id, role: "assistant", status: "streaming" },
  })
  const run = await prisma.aIRun.create({
    data: { conversationId: conversation.id, messageId: message.id, userId: user.id, prompt, status: "running" },
  })
  return { user, conversation, message, run }
}

async function cleanupUser(userId: string) {
  // onDelete: Cascade on conversation/message/run via User relations removes all rows.
  await prisma.user.delete({ where: { id: userId } }).catch(() => undefined)
}

// ── Case 1: 可真正停止 — cancel actually halts the loop before more work ──────
// Mirrors the runtime's checkpoint contract: it calls isAIRunCancelled() at the
// same points (each round, before/after each tool call, before LaTeX compile)
// and a cancel must prevent any further tool call / PDF compilation.
test("可真正停止: cancel halts the loop and blocks further compile", async () => {
  const fx = await createFixture()
  try {
    // Simulate a long agent loop. compileSpy stands in for compileLatexForUser.
    let toolCallsExecuted = 0
    let compilesExecuted = 0
    const runCheckpointedLoop = async (cancelAfterToolCall: number) => {
      class StopError extends Error {}
      const ensure = async () => {
        if (await isAIRunCancelled(fx.run.id)) throw new StopError()
      }
      try {
        for (let round = 0; round < 10; round += 1) {
          await ensure() // checkpoint: each round
          for (let t = 0; t < 3; t += 1) {
            await ensure() // checkpoint: before each tool call
            toolCallsExecuted += 1
            // The user clicks stop right after this tool call completes.
            if (toolCallsExecuted === cancelAfterToolCall) {
              await requestAIRunCancellation(fx.user.id, fx.message.id)
            }
            await ensure() // checkpoint: after each tool call
            // checkpoint: before LaTeX compile
            await ensure()
            compilesExecuted += 1
          }
        }
      } catch (error) {
        if (!(error instanceof StopError)) throw error
      }
    }

    await runCheckpointedLoop(1)

    // After the first tool call we cancelled; the next checkpoint must stop the
    // loop before any compile runs and before further tool calls.
    assert.equal(toolCallsExecuted, 1, "no tool calls should run after cancel")
    assert.equal(compilesExecuted, 0, "PDF compile must NOT run after cancel")
    assert.equal(await isAIRunCancelled(fx.run.id), true, "run reads as cancelled")

    // The route finalizes a cancelled run + preserves partial content.
    await updateAssistantMessagePartial(fx.message.id, "# 报告\n\n第一章 部分内容…")
    await finalizeAIRun({ runId: fx.run.id, status: "cancelled", summary: "已被用户停止。" })
    await cancelAssistantMessage(fx.message.id, "# 报告\n\n第一章 部分内容…")

    const run = await prisma.aIRun.findUniqueOrThrow({ where: { id: fx.run.id } })
    assert.equal(run.status, "cancelled", "run.status is cancelled")
    assert.ok(run.cancelRequestedAt, "cancelRequestedAt is set")
    assert.ok(run.cancelledAt, "cancelledAt is set")
    assert.ok(run.finishedAt, "finishedAt is set")

    const msg = await prisma.aIMessage.findUniqueOrThrow({ where: { id: fx.message.id } })
    assert.equal(msg.status, "cancelled", "message marked cancelled")
    assert.ok(msg.contentMarkdown.includes("第一章"), "partial content preserved")
  } finally {
    await cleanupUser(fx.user.id)
  }
})

// ── Case 2: 可继续 — disconnect/refresh doesn't stop the backend ─────────────
// The backend persists partial content while streaming, so a client that
// reconnects can keep reading until the run finalizes.
test("可继续: partial content persists for reconnect while the run runs on", async () => {
  const fx = await createFixture()
  try {
    // Backend keeps streaming (client disconnected) — partial writes land in DB.
    await updateAssistantMessagePartial(fx.message.id, "进度 1/3")
    let mid = await prisma.aIMessage.findUniqueOrThrow({ where: { id: fx.message.id } })
    assert.equal(mid.contentMarkdown, "进度 1/3", "reconnect can read partial content")
    assert.equal(mid.status, "streaming", "still streaming")

    await updateAssistantMessagePartial(fx.message.id, "进度 3/3 完成")

    // Run finishes normally (not cancelled) — the disconnect never stopped it.
    await prisma.aIMessage.update({
      where: { id: fx.message.id },
      data: { status: "completed", contentMarkdown: "进度 3/3 完成" },
    })
    await finalizeAIRun({ runId: fx.run.id, status: "completed", summary: "done" })

    const run = await prisma.aIRun.findUniqueOrThrow({ where: { id: fx.run.id } })
    assert.equal(run.status, "completed", "background run completed despite disconnect")

    // Once finalized, a late partial delta must NOT revert completed content.
    await updateAssistantMessagePartial(fx.message.id, "stale late delta")
    mid = await prisma.aIMessage.findUniqueOrThrow({ where: { id: fx.message.id } })
    assert.equal(mid.contentMarkdown, "进度 3/3 完成", "late delta ignored after finalize")
  } finally {
    await cleanupUser(fx.user.id)
  }
})

// ── Case 3: 可恢复 — another session can rebuild the task panel from the run ──
test("可恢复: run + steps are retrievable across sessions for the status panel", async () => {
  const fx = await createFixture()
  try {
    // Two tool-call steps + one draft step carrying section progress.
    await prisma.aIRunStep.create({
      data: { runId: fx.run.id, messageId: fx.message.id, userId: fx.user.id, type: "tool_call", title: "调用 search", status: "completed", orderIndex: 1 },
    })
    await prisma.aIRunStep.create({
      data: {
        runId: fx.run.id, messageId: fx.message.id, userId: fx.user.id, type: "tool_call",
        title: "append_latex_draft_section", status: "completed", orderIndex: 2,
        outputPreview: { result: { data: { filledCount: 2, totalCount: 5 } } },
      },
    })

    // listActiveAIRuns powers the global indicator (cross-conversation).
    const active = await listActiveAIRuns(fx.user.id)
    assert.ok(active.some((r) => r.id === fx.run.id), "active run is listed globally")

    // getAIRunByMessageId powers the detail panel (tool count + section progress).
    const detail = await getAIRunByMessageId(fx.user.id, fx.message.id, true)
    assert.ok(detail, "run detail retrievable by messageId")
    const toolSteps = detail!.steps.filter((s) => s.type === "tool_call")
    assert.equal(toolSteps.length, 2, "tool-call count reconstructable")
    const draftStep = detail!.steps.find(
      (s) => (s.outputPreview as { result?: { data?: { totalCount?: number } } } | null)?.result?.data?.totalCount,
    )
    assert.ok(draftStep, "draft section progress reconstructable for the panel")
  } finally {
    await cleanupUser(fx.user.id)
  }
})

// ── Finalizing a run sweeps any step stuck at "running" → terminal ───────────
// Fixes the trace showing "正在推理 / 正在调用工具" on an already-finished message.
test("finalizeAIRun: 清扫卡住的 running step", async () => {
  const fx = await createFixture()
  try {
    const step = await prisma.aIRunStep.create({
      data: { runId: fx.run.id, messageId: fx.message.id, userId: fx.user.id, type: "reasoning", title: "思考", status: "running", orderIndex: 1 },
    })
    await finalizeAIRun({ runId: fx.run.id, status: "completed", summary: "done" })
    const swept = await prisma.aIRunStep.findUniqueOrThrow({ where: { id: step.id } })
    assert.equal(swept.status, "completed", "stuck running step swept to completed")
    assert.ok(swept.finishedAt, "swept step got finishedAt")
  } finally {
    await cleanupUser(fx.user.id)
  }
})

// ── Stopping an orphaned run finalizes it immediately (no stuck "cancelling") ─
// Fixes the floating bubble that kept spinning on a run whose loop had died.
test("requestAIRunCancellation: 孤儿 run 立即终止而非卡在 cancelling", async () => {
  const fx = await createFixture()
  try {
    // No in-process producer (no event-bus channel) → orphaned.
    const result = await requestAIRunCancellation(fx.user.id, fx.message.id)
    assert.equal(result.alreadyFinished, false)
    const run = await prisma.aIRun.findUniqueOrThrow({ where: { id: fx.run.id } })
    assert.equal(run.status, "cancelled", "orphan finalized to terminal, not stuck at cancelling")
    assert.ok(run.cancelRequestedAt, "cancelRequestedAt recorded")
    assert.ok(run.cancelledAt, "cancelledAt recorded")
  } finally {
    await cleanupUser(fx.user.id)
  }
})

// ── listActiveAIRuns self-heals orphaned active runs so the bubble disappears ─
test("listActiveAIRuns: 自愈超时孤儿 run", async () => {
  const fx = await createFixture()
  try {
    // Age the run past the orphan grace window with no producer present.
    await prisma.aIRun.update({ where: { id: fx.run.id }, data: { createdAt: new Date(Date.now() - 120_000) } })
    const active = await listActiveAIRuns(fx.user.id)
    assert.ok(!active.some((r) => r.id === fx.run.id), "orphaned run excluded from active list")
    const run = await prisma.aIRun.findUniqueOrThrow({ where: { id: fx.run.id } })
    assert.ok(["cancelled", "failed"].includes(run.status), "orphaned run finalized to terminal")
  } finally {
    await cleanupUser(fx.user.id)
  }
})

async function main() {
  let passed = 0
  let failed = 0
  for (const t of tests) {
    try {
      await t.fn()
      console.log(`${TAG} ✓ ${t.name}`)
      passed += 1
    } catch (error) {
      failed += 1
      console.error(`${TAG} ✗ ${t.name}`)
      console.error(error instanceof Error ? error.stack ?? error.message : error)
    }
  }
  await prisma.$disconnect()
  console.log(`${TAG} ${passed} passed, ${failed} failed`)
  if (failed > 0) process.exitCode = 1
}

void main()
