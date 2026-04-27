import "server-only"
import { createPrismaMemoryAdapter } from "@/lib/ai/memory/prisma-adapter"
import { safeGenerateAndStoreEmbedding } from "@/lib/ai/memory/embedding-service"
import { prisma } from "@/lib/db"
import type { MemoryAdapter } from "@/lib/ai/memory/adapter"
import type {
  MemoryFactInput,
  MemoryEventInput,
  MemoryToolEventInput,
  MemoryRecallOptions,
  MemoryRecallResult,
  MemorySettingsUpdateInput,
  MemorySaveResult,
} from "@/lib/ai/memory/types"

let _adapter: MemoryAdapter | null = null

function getAdapter(): MemoryAdapter {
  if (!_adapter) _adapter = createPrismaMemoryAdapter()
  return _adapter
}

// ── Settings ──────────────────────────────────────────────────────────────

export async function getMemorySettings(userId: string) {
  return getAdapter().getOrCreateSettings(userId)
}

export async function updateMemorySettings(userId: string, input: MemorySettingsUpdateInput) {
  return getAdapter().updateSettings(userId, input)
}

// ── MemoryFact ────────────────────────────────────────────────────────────

export async function saveMemoryFact(userId: string, input: MemoryFactInput): Promise<MemorySaveResult> {
  const settings = await getAdapter().getOrCreateSettings(userId)
  if (!settings.enableLongTermMemory) {
    return { ok: false, skipped: true, reason: "long_term_memory_disabled" }
  }
  const result = await getAdapter().saveFact(userId, input)
  if (result.ok && result.id) {
    void safeGenerateAndStoreEmbedding("MemoryFact", result.id, "fact", input as unknown as Record<string, unknown>, prisma as unknown as { $executeRawUnsafe: (sql: string) => Promise<unknown> })
  }
  return result
}

export async function listMemoryFacts(
  userId: string,
  options?: { category?: string; limit?: number; offset?: number },
) {
  return getAdapter().listFacts(userId, options)
}

export async function getMemoryFact(userId: string, memoryId: string) {
  return getAdapter().getFact(userId, memoryId)
}

export async function updateMemoryFact(
  userId: string,
  memoryId: string,
  input: { title?: string; content?: string; category?: string; tags?: string[]; importance?: string; expiresAt?: string | null },
) {
  const result = await getAdapter().updateFact(userId, memoryId, input)
  // Re-generate embedding if content fields changed
  if (result.ok && result.id && (input.title !== undefined || input.content !== undefined || input.category !== undefined || input.tags !== undefined)) {
    const existing = await getAdapter().getFact(userId, memoryId)
    if (existing) {
      void safeGenerateAndStoreEmbedding("MemoryFact", memoryId, "fact", existing as unknown as Record<string, unknown>, prisma as unknown as { $executeRawUnsafe: (sql: string) => Promise<unknown> })
    }
  }
  return result
}

export async function softDeleteMemoryFact(userId: string, memoryId: string): Promise<boolean> {
  return getAdapter().softDeleteFact(userId, memoryId)
}

// ── MemoryEvent ───────────────────────────────────────────────────────────

export async function saveMemoryEvent(userId: string, input: MemoryEventInput): Promise<MemorySaveResult> {
  const settings = await getAdapter().getOrCreateSettings(userId)
  if (!settings.enableLongTermMemory) {
    return { ok: false, skipped: true, reason: "long_term_memory_disabled" }
  }
  if (!settings.enableConversationArchive) {
    return { ok: false, skipped: true, reason: "conversation_archive_disabled" }
  }
  const result = await getAdapter().saveEvent(userId, input)
  if (result.ok && result.id) {
    void safeGenerateAndStoreEmbedding("MemoryEvent", result.id, "event", input as unknown as Record<string, unknown>, prisma as unknown as { $executeRawUnsafe: (sql: string) => Promise<unknown> })
  }
  return result
}

export async function listMemoryEvents(
  userId: string,
  options?: { limit?: number; offset?: number },
) {
  return getAdapter().listEvents(userId, options)
}

// ── MemoryToolEvent ───────────────────────────────────────────────────────

export async function saveMemoryToolEvent(userId: string, input: MemoryToolEventInput): Promise<MemorySaveResult> {
  const settings = await getAdapter().getOrCreateSettings(userId)
  if (!settings.enableLongTermMemory) {
    return { ok: false, skipped: true, reason: "long_term_memory_disabled" }
  }
  if (!settings.enableToolMemoryEvents) {
    return { ok: false, skipped: true, reason: "tool_memory_events_disabled" }
  }
  const result = await getAdapter().saveToolEvent(userId, input)
  if (result.ok && result.id) {
    void safeGenerateAndStoreEmbedding("MemoryToolEvent", result.id, "tool_event", input as unknown as Record<string, unknown>, prisma as unknown as { $executeRawUnsafe: (sql: string) => Promise<unknown> })
  }
  return result
}

export async function listMemoryToolEvents(
  userId: string,
  options?: { limit?: number; offset?: number },
) {
  return getAdapter().listToolEvents(userId, options)
}

// ── Combined search ───────────────────────────────────────────────────────

export async function searchMemory(
  userId: string,
  options: MemoryRecallOptions,
): Promise<MemoryRecallResult> {
  const settings = await getAdapter().getOrCreateSettings(userId)
  if (!settings.enableMemoryRecall) {
    return { items: [], skipped: true, reason: "memory_recall_disabled" }
  }
  return getAdapter().search(userId, options)
}

// ── Memory Recall Context Builder ─────────────────────────────────────────

function truncate(value: string, maxChars: number): string {
  const trimmed = value.trim()
  if (trimmed.length <= maxChars) return trimmed
  return `${trimmed.slice(0, maxChars - 3)}...`
}

export interface MemoryContextResult {
  contextText: string
  itemCount: number
  skipped: boolean
  reason?: string
}

export async function buildMemoryContext(
  userId: string,
  query: string,
  options?: { limit?: number },
): Promise<MemoryContextResult> {
  try {
    const result = await searchMemory(userId, { query, limit: options?.limit ?? 5 })

    if (result.skipped) {
      return { contextText: "", itemCount: 0, skipped: true, reason: result.reason }
    }

    if (result.items.length === 0) {
      return { contextText: "", itemCount: 0, skipped: false }
    }

    const lines: string[] = []
    let totalChars = 0
    const maxTotalChars = 2000
    const maxPerItem = 300

    for (const item of result.items) {
      let line = ""
      if (item.type === "fact") {
        line = `[${item.category}] ${item.title}：${truncate(item.content, maxPerItem - item.title.length - 20)}`
      } else if (item.type === "event") {
        line = `[对话摘要] ${truncate(item.topicSummary, maxPerItem)}`
      } else if (item.type === "tool_event") {
        const mod = item.module ? ` (${item.module})` : ""
        const titlePart = item.title ? `：${item.title}` : ""
        line = `[操作记录] ${item.action}${mod}${titlePart}`
      }

      if (line.length > maxPerItem) line = truncate(line, maxPerItem)
      if (totalChars + line.length > maxTotalChars) break

      lines.push(line)
      totalChars += line.length
    }

    if (lines.length === 0) {
      return { contextText: "", itemCount: 0, skipped: false }
    }

    const header = "[蝶灵长期记忆 MEMORY]\n以下是当前用户过去可能相关的长期记忆，仅在与当前问题相关时使用；如果无关，请忽略，不要强行引用。\n"
    let contextText = header + lines.map((line, i) => `${i + 1}. ${line}`).join("\n")

    if (contextText.length > maxTotalChars) {
      contextText = truncate(contextText, maxTotalChars)
    }

    return { contextText, itemCount: lines.length, skipped: false }
  } catch {
    return { contextText: "", itemCount: 0, skipped: true, reason: "recall_error" }
  }
}

// ── Conversation Archive ──────────────────────────────────────────────────

export interface ConversationArchiveParams {
  conversationId: string
  messageId: string
  userPrompt: string
  assistantContent: string
  toolExecutions?: Array<{ name: string; title: string }>
}

export async function archiveConversation(
  userId: string,
  params: ConversationArchiveParams,
): Promise<MemorySaveResult> {
  try {
    const settings = await getAdapter().getOrCreateSettings(userId)
    if (!settings.enableLongTermMemory) {
      return { ok: false, skipped: true, reason: "long_term_memory_disabled" }
    }
    if (!settings.enableConversationArchive) {
      return { ok: false, skipped: true, reason: "conversation_archive_disabled" }
    }

    // Deterministic summary — no extra LLM call
    const topicSummary = truncate(params.userPrompt, 100)
    const keyTakeaways = params.assistantContent
      ? truncate(params.assistantContent, 300)
      : ""

    // Extract keywords from user prompt (simple)
    const keywords: string[] = []
    const toolNames = params.toolExecutions?.map((t) => t.name) ?? []
    if (toolNames.length > 0) keywords.push(...toolNames)

    // Extract relatedModules from tool names
    const relatedModules: string[] = []
    const moduleKeywords = ["blog", "daily", "reflections", "notes", "jobs", "interviews", "resume"]
    for (const mod of moduleKeywords) {
      if (params.userPrompt.includes(mod) || toolNames.some((t) => t.includes(mod))) {
        relatedModules.push(mod)
      }
    }

    const result = getAdapter().saveEvent(userId, {
      conversationId: params.conversationId,
      messageId: params.messageId,
      topicSummary,
      keyTakeaways,
      relatedModules,
      keywords,
      importance: toolNames.length > 0 ? "medium" : "low",
    })
    // Async embedding
    const pendingResult = await result
    if (pendingResult.ok && pendingResult.id) {
      void safeGenerateAndStoreEmbedding("MemoryEvent", pendingResult.id, "event", { topicSummary, keyTakeaways, relatedModules, keywords } as unknown as Record<string, unknown>, prisma as unknown as { $executeRawUnsafe: (sql: string) => Promise<unknown> })
    }
    return pendingResult
  } catch {
    return { ok: false, reason: "archive_error" }
  }
}

// ── Tool Memory Candidate ────────────────────────────────────────────────

export interface ToolMemoryCandidate {
  action: string
  module?: string | null
  title?: string | null
  articleId?: string | null
  folderId?: string | null
  folderName?: string | null
  sourceModule?: string | null
  targetModule?: string | null
  slugChanged?: boolean | null
  changedFields?: string[]
}

export async function saveToolMemoryCandidate(
  userId: string,
  candidate: ToolMemoryCandidate,
  sourceToolCallLogId?: string | null,
): Promise<MemorySaveResult> {
  try {
    const settings = await getAdapter().getOrCreateSettings(userId)
    if (!settings.enableLongTermMemory) {
      return { ok: false, skipped: true, reason: "long_term_memory_disabled" }
    }
    if (!settings.enableToolMemoryEvents) {
      return { ok: false, skipped: true, reason: "tool_memory_events_disabled" }
    }

    return getAdapter().saveToolEvent(userId, {
      action: candidate.action,
      module: candidate.module ?? null,
      title: candidate.title ?? null,
      articleId: candidate.articleId ?? null,
      folderId: candidate.folderId ?? null,
      folderName: candidate.folderName ?? null,
      sourceModule: candidate.sourceModule ?? null,
      targetModule: candidate.targetModule ?? null,
      slugChanged: candidate.slugChanged ?? null,
      changedFields: candidate.changedFields ?? [],
      sourceToolCallLogId: sourceToolCallLogId ?? null,
    })
  } catch {
    return { ok: false, reason: "candidate_save_error" }
  }
}
