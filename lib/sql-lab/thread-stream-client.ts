import type { SqlThreadStreamEvent } from "@/lib/sql-lab/types"
import type { SqlStageMode } from "@/lib/sql-lab/types"

type StreamAiOptions = {
  threadId: string
  prompt: string
  currentSql?: string
  lastError?: string
  stageMode?: SqlStageMode
  mode?: "draft" | "explain_selection" | "interpret_chart"
  chartContext?: unknown
  signal?: AbortSignal
  onEvent: (event: SqlThreadStreamEvent) => void
}

export async function streamThreadAi(options: StreamAiOptions): Promise<void> {
  const response = await fetch("/api/sql/ai/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      threadId: options.threadId,
      prompt: options.prompt,
      currentSql: options.currentSql,
      lastError: options.lastError,
      stageMode: options.stageMode,
      mode: options.mode,
      chartContext: options.chartContext,
    }),
    signal: options.signal,
    cache: "no-store",
  })
  if (!response.ok || !response.body) {
    const text = await response.text().catch(() => "")
    throw new Error(text || `AI 流请求失败：${response.status}`)
  }
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""

  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const parts = buffer.split("\n\n")
    buffer = parts.pop() ?? ""
    for (const part of parts) {
      const lines = part.split("\n")
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith("data:")) continue
        const json = trimmed.slice(5).trim()
        if (!json) continue
        try {
          const event = JSON.parse(json) as SqlThreadStreamEvent
          options.onEvent(event)
        } catch {
          // Ignore malformed line; stream continues
        }
      }
    }
  }
}

export function applyStreamEvent(
  prev: import("@/lib/sql-lab/types").SqlThreadDetail | null,
  event: SqlThreadStreamEvent,
): import("@/lib/sql-lab/types").SqlThreadDetail | null {
  if (!prev) return prev
  if (event.type === "step.created" || event.type === "step.completed") {
    const idx = prev.steps.findIndex((step) => step.id === event.step.id)
    const next = idx >= 0
      ? prev.steps.map((step, index) => (index === idx ? event.step : step))
      : [...prev.steps, event.step]
    return { ...prev, steps: next, status: event.type === "step.completed" && event.step.status === "error" ? "error" : prev.status }
  }
  if (event.type === "step.delta") {
    const idx = prev.steps.findIndex((step) => step.id === event.stepId)
    if (idx < 0) return prev
    const current = prev.steps[idx]
    const nextBody = event.bodyDelta ? current.bodyMarkdown + event.bodyDelta : current.bodyMarkdown
    const payloadBase = (current.payload ?? {}) as Record<string, unknown>
    let nextPayload = payloadBase
    if (event.payloadPatch) {
      nextPayload = { ...payloadBase }
      for (const [key, value] of Object.entries(event.payloadPatch)) {
        if (key === "reasoningDelta" && typeof value === "string") {
          nextPayload.reasoning = String(nextPayload.reasoning ?? "") + value
        } else if (key === "assistantDelta" && typeof value === "string") {
          nextPayload.assistant = String(nextPayload.assistant ?? "") + value
        } else {
          nextPayload[key] = value
        }
      }
    }
    const next = [...prev.steps]
    next[idx] = { ...current, bodyMarkdown: nextBody, payload: nextPayload }
    return { ...prev, steps: next }
  }
  if (event.type === "thread.updated") {
    return { ...prev, ...event.thread }
  }
  return prev
}
