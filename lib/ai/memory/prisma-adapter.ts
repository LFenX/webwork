import "server-only"
import { prisma } from "@/lib/db"
import { getMemoryEmbeddingConfig, generateEmbedding, serializeVector } from "@/lib/ai/memory/embedding-service"
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

function normalizeLimit(n: number | undefined, fallback: number, max: number): number {
  if (!Number.isFinite(n)) return fallback
  return Math.min(Math.max(Math.trunc(n as number), 1), max)
}

function matchesQuery(values: Array<string | null | undefined>, query: string): boolean {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (terms.length === 0) return false
  const haystack = values.filter(Boolean).join(" ").toLowerCase()
  return terms.every((term) => haystack.includes(term))
}

function parseJsonArray(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : []
  } catch {
    return []
  }
}

export function createPrismaMemoryAdapter(): MemoryAdapter {
  // ── Settings ──────────────────────────────────────────────────────────

  async function getOrCreateSettings(userId: string) {
    const existing = await prisma.memorySettings.findUnique({ where: { userId } })
    if (existing) return existing
    return prisma.memorySettings.create({ data: { userId } })
  }

  async function updateSettings(userId: string, input: MemorySettingsUpdateInput) {
    await getOrCreateSettings(userId)
    await prisma.memorySettings.update({
      where: { userId },
      data: input,
    })
  }

  // ── MemoryFact ────────────────────────────────────────────────────────

  async function saveFact(userId: string, input: MemoryFactInput): Promise<MemorySaveResult> {
    if (!input.title?.trim()) {
      return { ok: false, reason: "title_required" }
    }

    const record = await prisma.memoryFact.create({
      data: {
        userId,
        category: input.category ?? "other",
        title: input.title.trim(),
        content: input.content ?? "",
        tags: JSON.stringify(input.tags?.filter(Boolean) ?? []),
        source: input.source ?? "manual",
        sourceConversationId: input.sourceConversationId ?? null,
        sourceToolCallLogId: input.sourceToolCallLogId ?? null,
        importance: input.importance ?? "medium",
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      },
      select: { id: true },
    })

    return { ok: true, id: record.id }
  }

  async function listFacts(userId: string, options?: { category?: string; limit?: number; offset?: number }) {
    const where: Record<string, unknown> = { userId, deletedAt: null }
    if (options?.category) where.category = options.category

    const [items, total] = await Promise.all([
      prisma.memoryFact.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: normalizeLimit(options?.limit, 20, 50),
        skip: options?.offset ?? 0,
        select: {
          id: true, category: true, title: true, content: true,
          tags: true, source: true, importance: true,
          sourceConversationId: true, sourceToolCallLogId: true,
          createdAt: true, updatedAt: true,
        },
      }),
      prisma.memoryFact.count({ where }),
    ])

    return {
      items: items.map((item) => ({
        ...item,
        tags: parseJsonArray(item.tags),
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
      })),
      total,
    }
  }

  async function searchFacts(userId: string, query: string, options?: { limit?: number }) {
    const maxLimit = normalizeLimit(options?.limit, 10, 20)
    const records = await prisma.memoryFact.findMany({
      where: { userId, deletedAt: null },
      orderBy: [{ importance: "desc" as const }, { createdAt: "desc" as const }],
      select: {
        id: true, category: true, title: true, content: true,
        tags: true, source: true, importance: true, createdAt: true,
      },
    })

    return records
      .filter((item) =>
        matchesQuery([item.title, item.content, ...parseJsonArray(item.tags)], query)
      )
      .slice(0, maxLimit)
      .map((item) => ({
        ...item,
        tags: parseJsonArray(item.tags),
        createdAt: item.createdAt.toISOString(),
      }))
  }

  async function getFact(userId: string, memoryId: string) {
    const item = await prisma.memoryFact.findFirst({
      where: { id: memoryId, userId },
      select: {
        id: true, category: true, title: true, content: true,
        tags: true, source: true, importance: true,
        sourceConversationId: true, sourceToolCallLogId: true,
        expiresAt: true, deletedAt: true,
        createdAt: true, updatedAt: true,
      },
    })
    if (!item) return null
    return {
      ...item,
      tags: parseJsonArray(item.tags),
      expiresAt: item.expiresAt?.toISOString() ?? null,
      deletedAt: item.deletedAt?.toISOString() ?? null,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    }
  }

  async function updateFact(userId: string, memoryId: string, input: { title?: string; content?: string; category?: string; tags?: string[]; importance?: string; expiresAt?: string | null }) {
    const existing = await prisma.memoryFact.findFirst({
      where: { id: memoryId, userId, deletedAt: null },
      select: { id: true },
    })
    if (!existing) return { ok: false as const, reason: "not_found" }

    const data: Record<string, unknown> = {}
    if (input.title !== undefined) data.title = input.title.trim()
    if (input.content !== undefined) data.content = input.content
    if (input.category !== undefined) data.category = input.category
    if (input.tags !== undefined) data.tags = JSON.stringify(input.tags.filter(Boolean))
    if (input.importance !== undefined) data.importance = input.importance
    if (input.expiresAt !== undefined) data.expiresAt = input.expiresAt ? new Date(input.expiresAt) : null

    await prisma.memoryFact.update({ where: { id: memoryId }, data })
    return { ok: true as const, id: memoryId }
  }

  async function softDeleteFact(userId: string, memoryId: string): Promise<boolean> {
    const existing = await prisma.memoryFact.findFirst({
      where: { id: memoryId, userId, deletedAt: null },
      select: { id: true },
    })
    if (!existing) return false

    await prisma.memoryFact.update({
      where: { id: memoryId },
      data: { deletedAt: new Date() },
    })
    return true
  }

  // ── MemoryEvent ───────────────────────────────────────────────────────

  async function saveEvent(userId: string, input: MemoryEventInput): Promise<MemorySaveResult> {
    if (!input.topicSummary?.trim()) {
      return { ok: false, reason: "topic_summary_required" }
    }

    const record = await prisma.memoryEvent.create({
      data: {
        userId,
        conversationId: input.conversationId ?? null,
        messageId: input.messageId ?? null,
        topicSummary: input.topicSummary.trim(),
        keyTakeaways: input.keyTakeaways ?? "",
        relatedModules: JSON.stringify(input.relatedModules?.filter(Boolean) ?? []),
        keywords: JSON.stringify(input.keywords?.filter(Boolean) ?? []),
        importance: input.importance ?? "low",
        sensitive: input.sensitive ?? false,
      },
      select: { id: true },
    })

    return { ok: true, id: record.id }
  }

  async function listEvents(userId: string, options?: { limit?: number; offset?: number }) {
    const where = { userId, deletedAt: null }
    const [items, total] = await Promise.all([
      prisma.memoryEvent.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: normalizeLimit(options?.limit, 20, 50),
        skip: options?.offset ?? 0,
      }),
      prisma.memoryEvent.count({ where }),
    ])

    return {
      items: items.map((item) => ({
        ...item,
        relatedModules: parseJsonArray(item.relatedModules),
        keywords: parseJsonArray(item.keywords),
        createdAt: item.createdAt.toISOString(),
      })),
      total,
    }
  }

  async function searchEvents(userId: string, query: string, options?: { limit?: number }) {
    const maxLimit = normalizeLimit(options?.limit, 10, 20)
    const records = await prisma.memoryEvent.findMany({
      where: { userId, deletedAt: null },
      orderBy: [{ importance: "desc" as const }, { createdAt: "desc" as const }],
    })

    return records
      .filter((item) =>
        matchesQuery(
          [
            item.topicSummary,
            item.keyTakeaways,
            ...parseJsonArray(item.keywords),
            ...parseJsonArray(item.relatedModules),
          ],
          query,
        )
      )
      .slice(0, maxLimit)
      .map((item) => ({
        ...item,
        relatedModules: parseJsonArray(item.relatedModules),
        keywords: parseJsonArray(item.keywords),
        createdAt: item.createdAt.toISOString(),
      }))
  }

  // ── MemoryToolEvent ───────────────────────────────────────────────────

  async function saveToolEvent(userId: string, input: MemoryToolEventInput): Promise<MemorySaveResult> {
    if (!input.action?.trim()) {
      return { ok: false, reason: "action_required" }
    }

    const record = await prisma.memoryToolEvent.create({
      data: {
        userId,
        action: input.action,
        module: input.module ?? null,
        title: input.title ?? null,
        articleId: input.articleId ?? null,
        folderId: input.folderId ?? null,
        folderName: input.folderName ?? null,
        sourceModule: input.sourceModule ?? null,
        targetModule: input.targetModule ?? null,
        slugChanged: input.slugChanged ?? null,
        changedFields: JSON.stringify(input.changedFields?.filter(Boolean) ?? []),
        sourceToolCallLogId: input.sourceToolCallLogId ?? null,
      },
      select: { id: true },
    })

    return { ok: true, id: record.id }
  }

  async function listToolEvents(userId: string, options?: { limit?: number; offset?: number }) {
    const where = { userId, deletedAt: null }
    const [items, total] = await Promise.all([
      prisma.memoryToolEvent.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: normalizeLimit(options?.limit, 20, 50),
        skip: options?.offset ?? 0,
      }),
      prisma.memoryToolEvent.count({ where }),
    ])

    return {
      items: items.map((item) => ({
        ...item,
        changedFields: parseJsonArray(item.changedFields),
        createdAt: item.createdAt.toISOString(),
      })),
      total,
    }
  }

  async function searchToolEvents(userId: string, query: string, options?: { limit?: number }) {
    const maxLimit = normalizeLimit(options?.limit, 10, 20)
    const records = await prisma.memoryToolEvent.findMany({
      where: { userId, deletedAt: null },
      orderBy: { createdAt: "desc" as const },
    })

    return records
      .filter((item) =>
        matchesQuery(
          [
            item.title,
            item.action,
            item.module,
            item.sourceModule,
            item.targetModule,
            item.folderName,
            ...parseJsonArray(item.changedFields),
          ],
          query,
        )
      )
      .slice(0, maxLimit)
      .map((item) => ({
        ...item,
        changedFields: parseJsonArray(item.changedFields),
        createdAt: item.createdAt.toISOString(),
      }))
  }

  // ── Vector search ──────────────────────────────────────────────────────

  async function vectorSearchFacts(userId: string, queryVector: string, query: string, limit: number): Promise<MemoryRecallResult["items"]> {
    try {
      const raw = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
        `SELECT id, category, title, content, tags, source, importance, "createdAt", 1 - (embedding <=> $1::vector) AS score FROM "MemoryFact" WHERE "userId"=$2 AND "deletedAt" IS NULL AND embedding IS NOT NULL AND "embeddingStatus"='ready' ORDER BY embedding <=> $1::vector LIMIT $3`,
        queryVector, userId, limit
      )
      return raw.map(r => ({ type: "fact" as const, id: r.id as string, category: r.category as string, title: r.title as string, content: r.content as string, tags: parseJsonArray(String(r.tags ?? "[]")), source: r.source as string, importance: r.importance as string, createdAt: r.createdAt as string, score: Number(r.score) }))
    } catch { return [] }
  }

  async function vectorSearchEvents(userId: string, queryVector: string, query: string, limit: number): Promise<MemoryRecallResult["items"]> {
    try {
      const raw = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
        `SELECT id, "topicSummary", "keyTakeaways", "relatedModules", keywords, importance, "createdAt", 1 - (embedding <=> $1::vector) AS score FROM "MemoryEvent" WHERE "userId"=$2 AND "deletedAt" IS NULL AND embedding IS NOT NULL AND "embeddingStatus"='ready' ORDER BY embedding <=> $1::vector LIMIT $3`,
        queryVector, userId, limit
      )
      return raw.map(r => ({ type: "event" as const, id: r.id as string, topicSummary: r.topicSummary as string, keyTakeaways: r.keyTakeaways as string, relatedModules: parseJsonArray(String(r.relatedModules ?? "[]")), keywords: parseJsonArray(String(r.keywords ?? "[]")), importance: r.importance as string, createdAt: r.createdAt as string, score: Number(r.score) }))
    } catch { return [] }
  }

  async function vectorSearchToolEvents(userId: string, queryVector: string, query: string, limit: number): Promise<MemoryRecallResult["items"]> {
    try {
      const raw = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
        `SELECT id, action, module, title, "articleId", "folderId", "createdAt", 1 - (embedding <=> $1::vector) AS score FROM "MemoryToolEvent" WHERE "userId"=$2 AND "deletedAt" IS NULL AND embedding IS NOT NULL AND "embeddingStatus"='ready' ORDER BY embedding <=> $1::vector LIMIT $3`,
        queryVector, userId, limit
      )
      return raw.map(r => ({ type: "tool_event" as const, id: r.id as string, action: r.action as string, module: r.module as string | null, title: r.title as string | null, articleId: r.articleId as string | null, folderId: r.folderId as string | null, createdAt: r.createdAt as string, score: Number(r.score) }))
    } catch { return [] }
  }

  // ── Combined search (hybrid: semantic + keyword) ───────────────────────

  async function search(userId: string, options: MemoryRecallOptions): Promise<MemoryRecallResult> {
    const limit = normalizeLimit(options.limit, 10, 20)
    const keywordResults: MemoryRecallResult["items"] = []
    const semanticResults: MemoryRecallResult["items"] = []

    // Keyword search (always runs)
    const facts = await searchFacts(userId, options.query, { limit })
    for (const item of facts) {
      keywordResults.push({
        type: "fact", id: item.id, category: item.category, title: item.title,
        content: item.content, tags: item.tags as string[], source: item.source as string,
        importance: item.importance as string, createdAt: item.createdAt as string,
      })
    }

    if (options.includeEvent !== false) {
      const events = await searchEvents(userId, options.query, { limit: Math.ceil(limit / 4) })
      for (const item of events) {
        keywordResults.push({
          type: "event", id: item.id, topicSummary: item.topicSummary,
          keyTakeaways: item.keyTakeaways, relatedModules: item.relatedModules as string[],
          keywords: item.keywords as string[], importance: item.importance as string,
          createdAt: item.createdAt as string,
        })
      }
    }

    if (options.includeToolEvent !== false) {
      const toolEvents = await searchToolEvents(userId, options.query, { limit: Math.ceil(limit / 4) })
      for (const item of toolEvents) {
        keywordResults.push({
          type: "tool_event", id: item.id, action: item.action,
          module: item.module as string | null, title: item.title as string | null,
          articleId: item.articleId as string | null, folderId: item.folderId as string | null,
          createdAt: item.createdAt as string,
        })
      }
    }

    // Semantic search (runs if embedding provider is enabled)
    const embConfig = getMemoryEmbeddingConfig()
    if (embConfig.enabled) {
      const queryEmbedding = await generateEmbedding(options.query)
      if (queryEmbedding) {
        const queryVec = serializeVector(queryEmbedding)
        const semFacts = await vectorSearchFacts(userId, queryVec, options.query, limit)
        semanticResults.push(...semFacts)
        if (options.includeEvent !== false) {
          const semEvents = await vectorSearchEvents(userId, queryVec, options.query, Math.ceil(limit / 3))
          semanticResults.push(...semEvents)
        }
        if (options.includeToolEvent !== false) {
          const semTools = await vectorSearchToolEvents(userId, queryVec, options.query, Math.ceil(limit / 3))
          semanticResults.push(...semTools)
        }
      }
    }

    // Filter low-relevance semantic results before merging (threshold: 0.30)
    const SEMANTIC_SCORE_THRESHOLD = 0.30
    const filteredSemantic = semanticResults.filter(
      (item) => !("score" in item) || (item as { score: number }).score >= SEMANTIC_SCORE_THRESHOLD,
    )

    // Merge: semantic first (higher relevance), then keyword (deduplicated)
    const seen = new Set<string>()
    const merged: MemoryRecallResult["items"] = []

    for (const item of filteredSemantic) {
      if (!seen.has(item.id)) { seen.add(item.id); merged.push(item) }
    }
    for (const item of keywordResults) {
      if (!seen.has(item.id)) { seen.add(item.id); merged.push(item) }
    }

    // Sort: score (semantic) first, then importance, then createdAt
    merged.sort((a, b) => {
      const scoreA = "score" in a ? (a.score as number) : 0
      const scoreB = "score" in b ? (b.score as number) : 0
      if (scoreA !== scoreB) return scoreB - scoreA
      const impOrder = { high: 3, medium: 2, low: 1 }
      const impA = "importance" in a ? a.importance as string : "low"
      const impB = "importance" in b ? b.importance as string : "low"
      const impDiff = (impOrder[impB as keyof typeof impOrder] ?? 1) - (impOrder[impA as keyof typeof impOrder] ?? 1)
      if (impDiff !== 0) return impDiff
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })

    return { items: merged.slice(0, limit), skipped: false }
  }

  return {
    getOrCreateSettings,
    updateSettings,
    saveFact,
    getFact,
    updateFact,
    listFacts,
    searchFacts,
    softDeleteFact,
    saveEvent,
    listEvents,
    searchEvents,
    saveToolEvent,
    listToolEvents,
    searchToolEvents,
    search,
  }
}
