import "server-only"
import { prisma } from "@/lib/db"

export type AIUsageConfigSource =
  | "user_config"
  | "admin_grant"
  | "system_default"
  | "unknown"

export type AIUsageCallType = "chat" | "summary" | "fallback"

export type AIUsageInput = {
  userId: string
  conversationId?: string | null
  runId?: string | null
  messageId?: string | null
  callType: AIUsageCallType
  providerLabel: string
  providerType?: string
  baseUrl?: string
  model: string
  configSource: AIUsageConfigSource
  status: "success" | "failed"
  errorMessage?: string
  startedAt: number
  toolCallCount?: number
  providerUsage?: unknown
}

type ExtractedUsage = {
  inputTokens: number
  outputTokens: number
  totalTokens: number
  cachedInputTokens: number
  reasoningTokens: number
  hasRealUsage: boolean
}

function pickNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return Math.round(value)
  }
  return 0
}

function pickFirstNumber(source: Record<string, unknown>, keys: string[]): number {
  for (const key of keys) {
    const value = source[key]
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
      return Math.round(value)
    }
  }
  return 0
}

export function extractUsageFromProvider(raw: unknown): ExtractedUsage {
  const empty: ExtractedUsage = {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    cachedInputTokens: 0,
    reasoningTokens: 0,
    hasRealUsage: false,
  }
  if (!raw || typeof raw !== "object") return empty

  const usage = raw as Record<string, unknown>

  const inputTokens = pickFirstNumber(usage, [
    "prompt_tokens",
    "input_tokens",
    "promptTokens",
    "inputTokens",
  ])
  const outputTokens = pickFirstNumber(usage, [
    "completion_tokens",
    "output_tokens",
    "completionTokens",
    "outputTokens",
  ])
  const totalTokens =
    pickFirstNumber(usage, ["total_tokens", "totalTokens"]) ||
    inputTokens + outputTokens

  const promptDetails =
    usage.prompt_tokens_details && typeof usage.prompt_tokens_details === "object"
      ? (usage.prompt_tokens_details as Record<string, unknown>)
      : null
  const completionDetails =
    usage.completion_tokens_details && typeof usage.completion_tokens_details === "object"
      ? (usage.completion_tokens_details as Record<string, unknown>)
      : null

  const cachedInputTokens =
    pickFirstNumber(usage, [
      "prompt_cache_hit_tokens",
      "cache_read_input_tokens",
      "cached_input_tokens",
      "cached_tokens",
    ]) || (promptDetails ? pickNumber(promptDetails.cached_tokens) : 0)

  const reasoningTokens =
    pickFirstNumber(usage, ["reasoning_tokens"]) ||
    (completionDetails ? pickNumber(completionDetails.reasoning_tokens) : 0)

  const hasRealUsage =
    inputTokens > 0 || outputTokens > 0 || totalTokens > 0

  return {
    inputTokens,
    outputTokens,
    totalTokens,
    cachedInputTokens,
    reasoningTokens,
    hasRealUsage,
  }
}

export function resolveConfigSource(value: unknown): AIUsageConfigSource {
  switch (value) {
    case "user":
    case "user_config":
      return "user_config"
    case "grant":
    case "admin_grant":
      return "admin_grant"
    case "system":
    case "system_default":
      return "system_default"
    default:
      return "unknown"
  }
}

export async function recordAIUsage(input: AIUsageInput): Promise<void> {
  // Logging must never break chat — swallow every error.
  try {
    const usage = extractUsageFromProvider(input.providerUsage)
    const latencyMs = Math.max(0, Date.now() - input.startedAt)

    await prisma.aIUsageLog.create({
      data: {
        userId: input.userId,
        conversationId: input.conversationId ?? null,
        runId: input.runId ?? null,
        messageId: input.messageId ?? null,
        callType: input.callType,
        providerLabel: (input.providerLabel ?? "").slice(0, 200),
        providerType: (input.providerType ?? "").slice(0, 100),
        baseUrl: (input.baseUrl ?? "").slice(0, 500),
        model: (input.model ?? "").slice(0, 200),
        configSource: input.configSource,
        status: input.status,
        errorMessage: (input.errorMessage ?? "").slice(0, 1000),
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        totalTokens: usage.totalTokens,
        cachedInputTokens: usage.cachedInputTokens,
        reasoningTokens: usage.reasoningTokens,
        toolCallCount: input.toolCallCount ?? 0,
        latencyMs,
        hasRealUsage: usage.hasRealUsage,
      },
    })
  } catch {
    // Intentionally swallow — usage logging must not affect the assistant flow.
  }
}
