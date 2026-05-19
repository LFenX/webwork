import { NextRequest } from "next/server"
import { requireAuth } from "@/lib/auth"
import { requestProviderChat, type ProviderMessage } from "@/lib/ai/provider"
import { getEffectiveProviderConfig } from "@/lib/ai/service"
import { recordAIUsage, resolveConfigSource } from "@/lib/ai/usage-logger"
import { buildSqlAiContext } from "@/lib/sql-lab/ai/context-builder"
import { runSqlAgentLoop } from "@/lib/sql-lab/ai/agent-loop"
import { buildSqlRepairMessages, validateDraftSql } from "@/lib/sql-lab/ai/self-validation"
import { decideSqlSafety } from "@/lib/sql-lab/ai/safety-bar"
import { SQL_STAGE_SELECTOR_PROMPT, SQL_STAGE_SYSTEM_PROMPT } from "@/lib/sql-lab/ai/system-prompts"
import { cancelActiveSql, executeSql, getEffectiveSchema, jsonError } from "@/lib/sql-lab/service"
import {
  appendThreadStep,
  setThreadStatus,
  updateThreadStep,
} from "@/lib/sql-lab/threads"
import {
  catalogKey,
  searchSqlCatalog,
} from "@/lib/sql-lab/table-catalog"
import type {
  SqlCatalogMatch,
  SqlRunResult,
  SqlSchema,
  SqlStageMode,
  SqlTableInfo,
  SqlThreadCandidateTable,
  SqlThreadStep,
  SqlThreadStreamEvent,
} from "@/lib/sql-lab/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type SelectedSqlTable = SqlThreadCandidateTable

type StreamBody = {
  threadId: string
  prompt: string
  currentSql?: string
  lastError?: string
  stageMode?: SqlStageMode
  mode?: "draft" | "explain_selection" | "interpret_chart"
  chartContext?: unknown
}

function sseEvent(controller: ReadableStreamDefaultController<Uint8Array>, encoder: TextEncoder, payload: SqlThreadStreamEvent) {
  controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`))
}

function compactCatalog(match: SqlCatalogMatch) {
  return {
    schema: match.schema,
    table: match.table,
    score: Math.round(match.score),
    reasons: match.reasons,
    module: match.catalog.moduleName,
    submodule: match.catalog.submoduleName,
    description: match.catalog.description,
    keyFields: match.catalog.keyFields,
  }
}

function compactTable(table: SqlTableInfo) {
  return {
    schema: table.schema,
    name: table.name,
    scope: table.scope ?? "public",
    access: table.access,
    rows: table.rowCountEstimate ?? null,
    rowFilter: table.rowFilterPreview ?? "",
    catalog: table.catalog
      ? {
          module: table.catalog.moduleName,
          submodule: table.catalog.submoduleName,
          description: table.catalog.description,
          aliases: table.catalog.aliases,
          keywords: table.catalog.keywords,
          keyFields: table.catalog.keyFields,
          useCases: table.catalog.useCases,
        }
      : null,
    columns: table.columns.map((column) => ({
      name: column.name,
      type: column.dataType,
      nullable: column.nullable,
      primaryKey: Boolean(column.isPrimaryKey),
      foreignKey: Boolean(column.isForeignKey),
      masked: Boolean(column.isMasked),
    })),
  }
}

function extractJson<T extends object>(text: string, fallback: T): T {
  const trimmed = text.trim()
  const candidates = [
    trimmed,
    trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] ?? "",
    trimmed.match(/\{[\s\S]*\}/)?.[0] ?? "",
  ].filter(Boolean)
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as T
      if (parsed && typeof parsed === "object") return parsed
    } catch {}
  }
  return fallback
}

function fallbackSelected(matches: SqlCatalogMatch[]): SelectedSqlTable[] {
  return matches.slice(0, 4).map((match, index) => ({
    schema: match.schema,
    table: match.table,
    role: index === 0 ? "primary" : "reference",
    reason: match.reasons[0] ?? match.catalog.description,
  }))
}

async function pickTablesWithModel(input: {
  provider: NonNullable<Awaited<ReturnType<typeof getEffectiveProviderConfig>>>
  prompt: string
  currentSql?: string
  lastError?: string
  matches: SqlCatalogMatch[]
  schema: SqlSchema
  signal?: AbortSignal
}): Promise<{ selected: SelectedSqlTable[]; confidence: number; reasoningMarkdown: string }> {
  const fallback = fallbackSelected(input.matches)
  const top = input.matches[0]
  const second = input.matches[1]
  const fallbackConfidence = top ? Math.min(0.92, top.score / 140) : 0.15
  if (top && (top.score >= 110 || top.score >= (second?.score ?? 0) + 50)) {
    return {
      selected: fallback,
      confidence: fallbackConfidence,
      reasoningMarkdown: `目录检索直接命中 \`${top.schema}.${top.table}\`：${top.reasons.join("、") || top.catalog.description}`,
    }
  }
  if (!input.matches.length) {
    return { selected: [], confidence: 0.15, reasoningMarkdown: "目录里没有匹配候选，需要用户补充业务对象。" }
  }
  try {
    const result = await requestProviderChat({
      provider: { ...input.provider, temperature: 0 },
      messages: [
        { role: "system", content: SQL_STAGE_SELECTOR_PROMPT },
        {
          role: "user",
          content: JSON.stringify({
            prompt: input.prompt,
            currentSql: input.currentSql ?? "",
            lastError: input.lastError ?? "",
            candidates: input.matches.slice(0, 12).map(compactCatalog),
          }),
        },
      ],
      stream: false,
      toolChoice: "none",
      timeoutMs: 18_000,
      signal: input.signal,
    })
    const parsed = extractJson<{
      selected?: Array<{ schema?: string; table?: string; reason?: string; role?: string }>
      confidence?: number
      reasoningMarkdown?: string
    }>(result.assistantText, {})
    const allowed = new Set(input.matches.map((match) => catalogKey(match.schema, match.table)))
    const selected = (parsed.selected ?? [])
      .map((item): SelectedSqlTable | null => {
        const schema = typeof item.schema === "string" ? item.schema : "public"
        const table = typeof item.table === "string" ? item.table : ""
        if (!table || !allowed.has(catalogKey(schema, table))) return null
        const role = item.role === "join" || item.role === "reference" ? item.role : "primary"
        return {
          schema,
          table,
          role,
          reason: typeof item.reason === "string" && item.reason.trim() ? item.reason.trim() : "目录候选匹配",
        }
      })
      .filter((item): item is SelectedSqlTable => Boolean(item))
      .slice(0, 5)
    return {
      selected: selected.length ? selected : fallback,
      confidence: Math.max(0, Math.min(1, typeof parsed.confidence === "number" ? parsed.confidence : fallbackConfidence)),
      reasoningMarkdown: typeof parsed.reasoningMarkdown === "string" ? parsed.reasoningMarkdown : "",
    }
  } catch {
    return { selected: fallback, confidence: fallbackConfidence, reasoningMarkdown: "" }
  }
}

function summarizeRun(result: SqlRunResult): { rowCount: number; truncated: boolean; columns: number } {
  const last = result.resultSets[result.resultSets.length - 1]
  return {
    rowCount: last?.rowCount ?? 0,
    truncated: Boolean(last?.truncated),
    columns: last?.columns?.length ?? 0,
  }
}

function sampleRows(result: SqlRunResult, max = 20) {
  const last = result.resultSets[result.resultSets.length - 1]
  if (!last) return []
  return last.rows.slice(0, max)
}

async function appendRunStep(input: {
  userId: string
  threadId: string
  sql: string
  title: string
  result: SqlRunResult
  emit: (event: SqlThreadStreamEvent) => void
  extraPayload?: Record<string, unknown>
}) {
  const summary = summarizeRun(input.result)
  const last = input.result.resultSets[input.result.resultSets.length - 1]
  const step = await appendThreadStep(input.userId, {
    threadId: input.threadId,
    kind: "sql_run",
    status: input.result.ok ? "done" : "error",
    title: input.title || (input.result.ok ? `${summary.rowCount} 行结果` : "执行失败"),
    bodyMarkdown: input.result.ok
      ? `安全栏自动执行成功，返回 ${summary.rowCount} 行${summary.truncated ? "（已截断）" : ""}，耗时 ${input.result.durationMs} ms。`
      : `安全栏自动执行失败：${input.result.error?.message ?? "未知错误"}`,
    sql: input.sql,
    durationMs: input.result.durationMs,
    payload: {
      runId: input.result.runId,
      ok: input.result.ok,
      rowCount: summary.rowCount,
      truncated: summary.truncated,
      columns: last?.columns ?? [],
      sampleRows: sampleRows(input.result),
      touchedTables: input.result.touchedTables ?? [],
      warnings: input.result.warnings,
      error: input.result.error,
      ...input.extraPayload,
    },
    errorMessage: input.result.ok ? null : input.result.error?.message ?? "执行失败",
  })
  input.emit({ type: "step.completed", step })
  return step
}

export async function POST(req: NextRequest) {
  let session
  try {
    session = await requireAuth()
  } catch (error) {
    return jsonError(error)
  }
  const body = (await req.json().catch(() => ({}))) as StreamBody
  if (!body?.threadId || !body?.prompt?.trim()) {
    return jsonError(new Error("缺少 threadId 或 prompt"))
  }

  const stageMode: SqlStageMode =
    body.stageMode === "analyst" || body.stageMode === "manual" ? body.stageMode : "auto"
  const streamMode = body.mode ?? "draft"
  const encoder = new TextEncoder()
  let thinkingStepId: string | null = null
  let aborted = false

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: SqlThreadStreamEvent) => sseEvent(controller, encoder, event)
      const safeEmit = (event: SqlThreadStreamEvent) => {
        try {
          emit(event)
        } catch {}
      }
      const markAborted = async () => {
        if (aborted) return
        aborted = true
        await cancelActiveSql(session.userId, body.threadId).catch(() => undefined)
        if (thinkingStepId) {
          await updateThreadStep(session.userId, {
            stepId: thinkingStepId,
            status: "aborted",
            title: "已叫停",
            bodyMarkdown: "用户已叫停本次 AI 分析。",
            errorMessage: "aborted",
          }).catch(() => undefined)
        }
        await setThreadStatus(body.threadId, "idle").catch(() => undefined)
      }

      req.signal.addEventListener("abort", () => void markAborted(), { once: true })

      try {
        await setThreadStatus(body.threadId, "running").catch(() => undefined)

        const userStep = await appendThreadStep(session.userId, {
          threadId: body.threadId,
          kind: "user_prompt",
          status: "done",
          title: streamMode === "explain_selection" ? "解释选中 SQL" : streamMode === "interpret_chart" ? "解读图表" : "你的问题",
          bodyMarkdown: body.prompt.trim(),
        })
        safeEmit({ type: "step.completed", step: userStep })

        const provider = await getEffectiveProviderConfig(session.userId)
        if (!provider) {
          const errStep = await appendThreadStep(session.userId, {
            threadId: body.threadId,
            kind: "ai_error",
            status: "error",
            title: "AI 未授权",
            bodyMarkdown: "当前账号没有可用的 AI 配置，请先在蝶灵设置里配置模型。",
            errorMessage: "no_provider",
          })
          safeEmit({ type: "step.completed", step: errStep })
          safeEmit({ type: "done", threadId: body.threadId })
          await setThreadStatus(body.threadId, "error").catch(() => undefined)
          controller.close()
          return
        }

        const schema = await getEffectiveSchema(session.userId)
        const toolStep = await appendThreadStep(session.userId, {
          threadId: body.threadId,
          kind: "tool_call",
          status: "running",
          title: "catalog_search",
          bodyMarkdown: "在数据目录中检索候选表…",
          payload: { tool: "catalog_search", input: { prompt: body.prompt } },
        })
        safeEmit({ type: "step.created", step: toolStep })
        const matches = searchSqlCatalog(
          schema,
          { prompt: body.prompt, currentSql: body.currentSql, lastError: body.lastError },
          14,
        )
        const toolCompleted = await updateThreadStep(session.userId, {
          stepId: toolStep.id,
          status: "done",
          bodyMarkdown: `命中 ${matches.length} 张候选表` + (matches.length ? `：${matches.slice(0, 5).map((m) => `\`${m.schema}.${m.table}\``).join("、")}` : "。"),
          payload: { tool: "catalog_search", matches: matches.map(compactCatalog) },
        })
        safeEmit({ type: "step.completed", step: toolCompleted })

        const picker = await pickTablesWithModel({
          provider,
          prompt: body.prompt,
          currentSql: body.currentSql,
          lastError: body.lastError,
          matches,
          schema,
          signal: req.signal,
        })
        const context = await buildSqlAiContext({
          userId: session.userId,
          threadId: body.threadId,
          prompt: body.prompt,
          schema,
          selected: picker.selected,
        })

        const candidatesStep = await appendThreadStep(session.userId, {
          threadId: body.threadId,
          kind: "candidate_tables",
          status: "done",
          title: "AI 推荐数据表",
          bodyMarkdown: picker.reasoningMarkdown,
          payload: {
            tables: context.selected,
            confidence: picker.confidence,
            matches: matches.slice(0, 8).map(compactCatalog),
            fkExpanded: context.selected.length > picker.selected.length,
          },
        })
        safeEmit({ type: "step.completed", step: candidatesStep })

        const thinkingStep = await appendThreadStep(session.userId, {
          threadId: body.threadId,
          kind: "ai_thinking",
          status: "running",
          title: stageMode === "analyst" ? "分析师模式运行中" : "正在生成",
          bodyMarkdown: "",
          payload: { reasoning: "", assistant: "", stageMode },
        })
        thinkingStepId = thinkingStep.id
        safeEmit({ type: "step.created", step: thinkingStep })

        let reasoningBuf = ""
        let assistantBuf = ""
        let lastFlush = Date.now()
        const FLUSH_MS = 1200

        const flushIfNeeded = async (force = false) => {
          if (!force && Date.now() - lastFlush < FLUSH_MS) return
          lastFlush = Date.now()
          await updateThreadStep(session.userId, {
            stepId: thinkingStep.id,
            payload: { reasoning: reasoningBuf, assistant: assistantBuf, stageMode },
            bodyMarkdown: assistantBuf.slice(-2400),
          }).catch(() => undefined)
        }

        const privateSchema = schema.schemas.find((item) => item.scope === "private")?.name
        const modeInstruction =
          streamMode === "explain_selection"
            ? "本次任务是解释用户选中的 SQL 片段。优先返回 message/reasoningMarkdown，除非需要修正才给 sql。"
            : streamMode === "interpret_chart"
              ? "本次任务是解读图表结果。不要生成新 SQL，除非用户明确要求追问查询。"
              : stageMode === "analyst"
                ? "当前为 Analyst 深度分析模式。你可以在最终回答前调用 run_safe_sql 做必要探查。"
                : stageMode === "manual"
                  ? "当前为 Manual Approve 模式。可以生成 SQL，但不要假设它会自动执行。"
                  : "当前为 Safe Auto 模式。只读 SQL 通过自检后会自动执行，DML/DDL 会暂停。"

        const baseMessages: ProviderMessage[] = [
          { role: "system", content: SQL_STAGE_SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              `## 模式\n${modeInstruction}`,
              `## 用户问题\n${body.prompt}`,
              body.currentSql ? `## 当前编辑器 SQL\n\`\`\`sql\n${body.currentSql}\n\`\`\`` : "",
              body.lastError ? `## 上次错误\n${body.lastError}` : "",
              body.chartContext ? `## 图表上下文\n${JSON.stringify(body.chartContext)}` : "",
              `## 结构化数据上下文\n${context.promptMarkdown}`,
              `## 目录候选摘要\n${JSON.stringify(matches.slice(0, 10).map(compactCatalog))}`,
              `## 选中表 JSON\n${JSON.stringify(context.tables.map(compactTable))}`,
            ].filter(Boolean).join("\n\n"),
          },
        ]

        let providerError: unknown = null
        let providerResult: Awaited<ReturnType<typeof runSqlAgentLoop>>["result"] | null = null
        const startedAt = Date.now()
        try {
          const loop = await runSqlAgentLoop({
            userId: session.userId,
            threadId: body.threadId,
            provider,
            messages: baseMessages,
            toolsEnabled: stageMode === "analyst" && streamMode === "draft",
            signal: req.signal,
            emit: safeEmit,
            onReasoningDelta: async (delta) => {
              if (!delta) return
              reasoningBuf += delta
              safeEmit({
                type: "step.delta",
                stepId: thinkingStep.id,
                orderIndex: thinkingStep.orderIndex,
                kind: "ai_thinking",
                payloadPatch: { reasoningDelta: delta },
              })
              await flushIfNeeded()
            },
            onAssistantDelta: async (delta) => {
              if (!delta) return
              assistantBuf += delta
              safeEmit({
                type: "step.delta",
                stepId: thinkingStep.id,
                orderIndex: thinkingStep.orderIndex,
                kind: "ai_thinking",
                bodyDelta: delta,
              })
              await flushIfNeeded()
            },
          })
          providerResult = loop.result
        } catch (error) {
          providerError = error
        }

        await flushIfNeeded(true)

        if (providerError || !providerResult || aborted) {
          const errMsg = aborted ? "用户已叫停" : providerError instanceof Error ? providerError.message : "AI provider failed"
          const failed = await updateThreadStep(session.userId, {
            stepId: thinkingStep.id,
            status: aborted ? "aborted" : "error",
            errorMessage: errMsg,
            bodyMarkdown: assistantBuf || errMsg,
          })
          safeEmit({ type: "step.completed", step: failed })
          if (!aborted) {
            const errStep = await appendThreadStep(session.userId, {
              threadId: body.threadId,
              kind: "ai_error",
              status: "error",
              title: "生成失败",
              bodyMarkdown: errMsg,
              errorMessage: errMsg,
            })
            safeEmit({ type: "step.completed", step: errStep })
          }
          await recordAIUsage({
            userId: session.userId,
            callType: "chat",
            providerLabel: provider.providerLabel,
            baseUrl: provider.baseUrl,
            model: provider.model,
            configSource: resolveConfigSource(provider.source),
            status: "failed",
            errorMessage: errMsg,
            startedAt,
            providerUsage: providerResult?.providerMetadata?.usage,
            toolCallCount: providerResult?.toolCalls.length ?? 0,
          })
          safeEmit({ type: "done", threadId: body.threadId })
          await setThreadStatus(body.threadId, aborted ? "idle" : "error").catch(() => undefined)
          controller.close()
          return
        }

        const parsed = extractJson<{
          message?: string
          sql?: string
          title?: string
          reasoningMarkdown?: string
          confidence?: number
          needsClarification?: boolean
          suggestedCharts?: unknown[]
        }>(providerResult.assistantText, { message: providerResult.assistantText, sql: "", title: "SQL Stage" })

        let sqlText = typeof parsed.sql === "string" ? parsed.sql.trim() : ""
        const title = (typeof parsed.title === "string" && parsed.title.trim() ? parsed.title.trim() : "SQL Stage").slice(0, 40)
        let messageText = typeof parsed.message === "string" ? parsed.message.trim() : ""
        let reasoningMarkdown = typeof parsed.reasoningMarkdown === "string" && parsed.reasoningMarkdown.trim()
          ? parsed.reasoningMarkdown.trim()
          : picker.reasoningMarkdown
        const confidence = Math.max(0, Math.min(1, typeof parsed.confidence === "number" ? parsed.confidence : picker.confidence))
        let selfValidation: Awaited<ReturnType<typeof validateDraftSql>> | null = null
        let repaired = false

        if (sqlText) {
          selfValidation = await validateDraftSql(session.userId, sqlText)
          if (!selfValidation.ok) {
            const repair = await requestProviderChat({
              provider: { ...provider, temperature: 0 },
              messages: buildSqlRepairMessages({
                prompt: body.prompt,
                contextMarkdown: context.promptMarkdown,
                sql: sqlText,
                errorMessage: selfValidation.error?.message ?? "PREPARE failed",
                errorHint: selfValidation.error?.hint,
              }),
              stream: false,
              toolChoice: "none",
              timeoutMs: 30_000,
              signal: req.signal,
            }).catch(() => null)
            if (repair?.assistantText) {
              const fixed = extractJson<{ sql?: string; message?: string; reasoningMarkdown?: string }>(repair.assistantText, {})
              if (fixed.sql?.trim()) {
                sqlText = fixed.sql.trim()
                messageText = fixed.message?.trim() || messageText
                reasoningMarkdown = fixed.reasoningMarkdown?.trim() || reasoningMarkdown
                repaired = true
                selfValidation = await validateDraftSql(session.userId, sqlText)
              }
            }
          }
        }

        const safety = sqlText ? decideSqlSafety(sqlText, { privateSchema }) : null
        const thinkingDone = await updateThreadStep(session.userId, {
          stepId: thinkingStep.id,
          status: "done",
          title: "AI 思考流",
          bodyMarkdown: reasoningMarkdown || assistantBuf.slice(-2400),
          payload: {
            reasoning: reasoningBuf,
            assistant: assistantBuf,
            confidence,
            stageMode,
            selfValidation,
            repaired,
            safety,
          },
          tokensIn: Number((providerResult.providerMetadata?.usage as { prompt_tokens?: number })?.prompt_tokens ?? 0),
          tokensOut: Number((providerResult.providerMetadata?.usage as { completion_tokens?: number })?.completion_tokens ?? 0),
        })
        safeEmit({ type: "step.completed", step: thinkingDone })

        let finalStep: SqlThreadStep
        if (sqlText) {
          const validationOk = selfValidation?.ok !== false
          finalStep = await appendThreadStep(session.userId, {
            threadId: body.threadId,
            kind: "sql_draft",
            status: validationOk ? "done" : "error",
            title: title || "SQL 草稿",
            bodyMarkdown: validationOk
              ? messageText || "我已经生成 SQL，并完成自检。"
              : `AI 自检未通过，建议手动修改：${selfValidation?.error?.message ?? "未知错误"}`,
            sql: sqlText,
            payload: {
              confidence,
              title,
              reasoningMarkdown,
              selectedTables: context.selected,
              needsClarification: Boolean(parsed.needsClarification),
              providerLabel: provider.providerLabel,
              providerModel: provider.model,
              selfValidated: validationOk,
              selfValidation,
              repaired,
              safety,
              suggestedCharts: parsed.suggestedCharts ?? [],
            },
            errorMessage: validationOk ? null : selfValidation?.error?.message ?? "AI 自检未通过",
          })
        } else {
          finalStep = await appendThreadStep(session.userId, {
            threadId: body.threadId,
            kind: "ai_insight",
            status: "done",
            title: title || "AI 解读",
            bodyMarkdown: messageText || "这次没有生成 SQL，可能需要补充更多上下文。",
            payload: {
              confidence,
              reasoningMarkdown,
              needsClarification: Boolean(parsed.needsClarification),
            },
          })
        }
        safeEmit({ type: "step.completed", step: finalStep })

        const canAutoRun =
          streamMode === "draft" &&
          sqlText &&
          finalStep.status === "done" &&
          stageMode !== "manual" &&
          safety?.action === "auto_execute"

        if (canAutoRun) {
          const runResult = await executeSql(session.userId, {
            sql: sqlText,
            limit: schema.defaultLimit,
            forceReadOnly: true,
          }, {
            threadId: body.threadId,
            threadStepId: finalStep.id,
            aiInitiated: true,
            probePurpose: "安全栏自动执行最终 SQL",
            timeoutMs: schema.defaultTimeoutMs,
            cancelKey: body.threadId,
          })
          await appendRunStep({
            userId: session.userId,
            threadId: body.threadId,
            sql: sqlText,
            title,
            result: runResult,
            emit: safeEmit,
            extraPayload: { suggestedCharts: parsed.suggestedCharts ?? [] },
          })
        } else if (sqlText && safety && safety.action !== "auto_execute") {
          const safetyStep = await appendThreadStep(session.userId, {
            threadId: body.threadId,
            kind: safety.action === "reject" ? "ai_error" : "ai_insight",
            status: safety.action === "reject" ? "error" : "done",
            title: safety.action === "reject" ? "安全栏拒绝" : "安全栏暂停",
            bodyMarkdown: safety.reason,
            payload: { safety },
            errorMessage: safety.action === "reject" ? safety.reason : null,
          })
          safeEmit({ type: "step.completed", step: safetyStep })
        }

        await recordAIUsage({
          userId: session.userId,
          callType: "chat",
          providerLabel: provider.providerLabel,
          baseUrl: provider.baseUrl,
          model: provider.model,
          configSource: resolveConfigSource(provider.source),
          status: "success",
          startedAt,
          providerUsage: providerResult.providerMetadata?.usage,
          toolCallCount: providerResult.toolCalls.length,
        })
        safeEmit({ type: "done", threadId: body.threadId })
        await setThreadStatus(body.threadId, "idle").catch(() => undefined)
        controller.close()
      } catch (error) {
        const message = error instanceof Error ? error.message : "未知错误"
        safeEmit({ type: "error", message })
        try {
          await appendThreadStep(session.userId, {
            threadId: body.threadId,
            kind: "ai_error",
            status: "error",
            title: "Stage 故障",
            bodyMarkdown: message,
            errorMessage: message,
          })
        } catch {}
        await setThreadStatus(body.threadId, "error").catch(() => undefined)
        controller.close()
      }
    },
    cancel() {
      aborted = true
      void cancelActiveSql(session.userId, body.threadId)
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}
