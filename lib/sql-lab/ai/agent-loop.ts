import "server-only"

import { requestProviderChat, type ProviderChatResult, type ProviderMessage } from "@/lib/ai/provider"
import { canRunProbe } from "@/lib/sql-lab/ai/probe-budget"
import { decideSqlSafety } from "@/lib/sql-lab/ai/safety-bar"
import { TOOL_RUN_SAFE_SQL } from "@/lib/sql-lab/ai/tools"
import { executeSafeProbe } from "@/lib/sql-lab/service"
import { appendThreadStep, updateThreadStep } from "@/lib/sql-lab/threads"
import type { AIResolvedProviderConfig } from "@/lib/ai/types"
import type { SqlThreadStreamEvent } from "@/lib/sql-lab/types"

type AgentLoopInput = {
  userId: string
  threadId: string
  provider: AIResolvedProviderConfig
  messages: ProviderMessage[]
  toolsEnabled: boolean
  signal?: AbortSignal
  emit: (event: SqlThreadStreamEvent) => void
  onReasoningDelta?: (delta: string) => Promise<void>
  onAssistantDelta?: (delta: string) => Promise<void>
}

function probePayload(result: Awaited<ReturnType<typeof executeSafeProbe>>, purpose: string, sql: string) {
  const last = result.resultSets[result.resultSets.length - 1]
  return {
    sql,
    purpose,
    ok: result.ok,
    rowCount: last?.rowCount ?? 0,
    columns: last?.columns ?? [],
    sampleRows: last?.rows?.slice(0, 20) ?? [],
    durationMs: result.durationMs,
    error: result.error,
    warnings: result.warnings,
  }
}

export async function runSqlAgentLoop(input: AgentLoopInput): Promise<{ result: ProviderChatResult; messages: ProviderMessage[]; probeCount: number }> {
  const messages = [...input.messages]
  let probeCount = 0
  let lastResult: ProviderChatResult | null = null

  for (let round = 0; round < 10; round += 1) {
    const result = await requestProviderChat({
      provider: { ...input.provider, temperature: Math.min(input.provider.temperature, 0.2) },
      messages,
      tools: input.toolsEnabled ? [TOOL_RUN_SAFE_SQL] : undefined,
      toolChoice: input.toolsEnabled ? "auto" : "none",
      stream: true,
      timeoutMs: 90_000,
      signal: input.signal,
      onReasoningDelta: input.onReasoningDelta,
      onAssistantDelta: input.onAssistantDelta,
    })
    lastResult = result

    const wantsTools = input.toolsEnabled && (result.toolCalls.length > 0 || result.finishReason === "tool_calls")
    if (!wantsTools || !result.toolCalls.length) return { result, messages, probeCount }

    messages.push({
      role: "assistant",
      content: result.assistantText || "",
      tool_calls: result.toolCalls.map((toolCall) => ({
        id: toolCall.id,
        type: "function",
        function: {
          name: toolCall.name,
          arguments: toolCall.argumentsText || "{}",
        },
      })),
    })

    for (const toolCall of result.toolCalls) {
      if (toolCall.name !== "run_safe_sql") {
        messages.push({ role: "tool", tool_call_id: toolCall.id, content: JSON.stringify({ ok: false, error: "unknown tool" }) })
        continue
      }

      const sql = typeof toolCall.arguments?.sql === "string" ? toolCall.arguments.sql.trim() : ""
      const purpose = typeof toolCall.arguments?.purpose === "string" ? toolCall.arguments.purpose.trim() : "AI 自主探查"
      const budget = await canRunProbe({ userId: input.userId, threadId: input.threadId, probesThisCall: probeCount })
      const safety = decideSqlSafety(sql, { forceReadOnly: true })
      if (!budget.ok || safety.action !== "auto_execute") {
        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify({
            ok: false,
            error: budget.ok ? safety.reason : budget.reason,
          }),
        })
        continue
      }

      const probeStep = await appendThreadStep(input.userId, {
        threadId: input.threadId,
        kind: "ai_probe_sql",
        status: "running",
        title: "AI 自主探查",
        bodyMarkdown: purpose,
        sql,
        payload: { sql, purpose, safety },
      })
      input.emit({ type: "step.created", step: probeStep })
      const result = await executeSafeProbe(input.userId, {
        sql,
        purpose,
        threadId: input.threadId,
        parentStepId: probeStep.id,
      })
      const payload = probePayload(result, purpose, sql)
      const completed = await updateThreadStep(input.userId, {
        stepId: probeStep.id,
        status: result.ok ? "done" : "error",
        bodyMarkdown: result.ok
          ? `${purpose}\n\n返回 ${payload.rowCount} 行，耗时 ${result.durationMs} ms。`
          : `${purpose}\n\n探查失败：${result.error?.message ?? "未知错误"}`,
        durationMs: result.durationMs,
        payload,
        errorMessage: result.ok ? null : result.error?.message ?? "探查失败",
      })
      input.emit({ type: "step.completed", step: completed })
      probeCount += 1
      messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: JSON.stringify(payload),
      })
    }
  }

  if (!lastResult) throw new Error("AI agent loop did not produce a result")
  return { result: lastResult, messages, probeCount }
}
