import "server-only"
import { Prisma } from "@/app/generated/prisma/client"
import { prisma } from "@/lib/db"

const ALLOWED_CONFIG_SOURCES = new Set([
  "user_config",
  "admin_grant",
  "system_default",
  "unknown",
])

export type UsageFilter = {
  from?: Date | null
  to?: Date | null
  userId?: string | null
  providerLabel?: string | null
  model?: string | null
  configSource?: string | null
}

export type UsageOverview = {
  totalRequests: number
  totalCalls: number
  totalTokens: number
  inputTokens: number
  outputTokens: number
  cachedInputTokens: number
  reasoningTokens: number
  toolCallCount: number
  activeUsers: number
  failedCalls: number
  callsWithRealUsage: number
  conversations: number
  avgLatencyMs: number
}

export type UsageByUserItem = {
  userId: string
  email: string
  displayName: string
  conversationCount: number
  runCount: number
  callCount: number
  totalTokens: number
  inputTokens: number
  outputTokens: number
  cachedInputTokens: number
  toolCallCount: number
  failedCalls: number
  topModel: string | null
  topProvider: string | null
  topConfigSource: string | null
  lastUsedAt: string | null
}

export type UsageByModelItem = {
  model: string
  providerLabel: string
  callCount: number
  inputTokens: number
  outputTokens: number
  totalTokens: number
  userCount: number
  toolCallCount: number
}

export type UsageByConfigSourceItem = {
  configSource: string
  callCount: number
  totalTokens: number
  userCount: number
}

export type UsageTimeseriesPoint = {
  bucket: string
  callCount: number
  totalTokens: number
  inputTokens: number
  outputTokens: number
}

export type UsageUserDetail = {
  user: { id: string; email: string; displayName: string }
  totals: UsageOverview
  modelBreakdown: UsageByModelItem[]
  configSourceBreakdown: UsageByConfigSourceItem[]
  timeline: UsageTimeseriesPoint[]
  conversations: Array<{
    id: string
    title: string
    callCount: number
    totalTokens: number
    inputTokens: number
    outputTokens: number
    lastUsedAt: string | null
  }>
  toolCalls: Array<{ toolName: string; callCount: number; failedCount: number; lastUsedAt: string | null }>
}

function buildWhere(filter: UsageFilter): Prisma.AIUsageLogWhereInput {
  const where: Prisma.AIUsageLogWhereInput = {}
  if (filter.from || filter.to) {
    where.createdAt = {}
    if (filter.from) (where.createdAt as Prisma.DateTimeFilter).gte = filter.from
    if (filter.to) (where.createdAt as Prisma.DateTimeFilter).lte = filter.to
  }
  if (filter.userId) where.userId = filter.userId
  if (filter.providerLabel) where.providerLabel = filter.providerLabel
  if (filter.model) where.model = filter.model
  if (filter.configSource && ALLOWED_CONFIG_SOURCES.has(filter.configSource)) {
    where.configSource = filter.configSource
  }
  return where
}

export function parseUsageFilterFromSearchParams(
  search: URLSearchParams,
  fallback?: { userId?: string },
): UsageFilter {
  const fromRaw = search.get("from")
  const toRaw = search.get("to")
  const from = fromRaw ? new Date(fromRaw) : null
  const to = toRaw ? new Date(toRaw) : null

  return {
    from: from && !Number.isNaN(from.getTime()) ? from : null,
    to: to && !Number.isNaN(to.getTime()) ? to : null,
    userId: fallback?.userId ?? search.get("userId") ?? null,
    providerLabel: search.get("provider") ?? null,
    model: search.get("model") ?? null,
    configSource: search.get("configSource") ?? null,
  }
}

export async function computeUsageOverview(filter: UsageFilter): Promise<UsageOverview> {
  const where = buildWhere(filter)

  const [agg, distinctUsers, distinctConversations, runDistinct, failedAgg] = await Promise.all([
    prisma.aIUsageLog.aggregate({
      where,
      _count: { _all: true },
      _sum: {
        inputTokens: true,
        outputTokens: true,
        totalTokens: true,
        cachedInputTokens: true,
        reasoningTokens: true,
        toolCallCount: true,
        latencyMs: true,
      },
    }),
    prisma.aIUsageLog
      .findMany({ where, distinct: ["userId"], select: { userId: true } })
      .then((rows) => rows.length),
    prisma.aIUsageLog
      .findMany({
        where: { ...where, conversationId: { not: null } },
        distinct: ["conversationId"],
        select: { conversationId: true },
      })
      .then((rows) => rows.length),
    prisma.aIUsageLog
      .findMany({
        where: { ...where, runId: { not: null } },
        distinct: ["runId"],
        select: { runId: true },
      })
      .then((rows) => rows.length),
    prisma.aIUsageLog.count({
      where: { ...where, status: "failed" },
    }),
  ])

  const callsWithRealUsage = await prisma.aIUsageLog.count({
    where: { ...where, hasRealUsage: true },
  })

  const totalCalls = agg._count._all
  return {
    totalRequests: runDistinct,
    totalCalls,
    totalTokens: agg._sum.totalTokens ?? 0,
    inputTokens: agg._sum.inputTokens ?? 0,
    outputTokens: agg._sum.outputTokens ?? 0,
    cachedInputTokens: agg._sum.cachedInputTokens ?? 0,
    reasoningTokens: agg._sum.reasoningTokens ?? 0,
    toolCallCount: agg._sum.toolCallCount ?? 0,
    activeUsers: distinctUsers,
    failedCalls: failedAgg,
    callsWithRealUsage,
    conversations: distinctConversations,
    avgLatencyMs: totalCalls > 0 ? Math.round((agg._sum.latencyMs ?? 0) / totalCalls) : 0,
  }
}

export async function computeUsageByUser(filter: UsageFilter): Promise<UsageByUserItem[]> {
  const where = buildWhere(filter)
  const grouped = await prisma.aIUsageLog.groupBy({
    by: ["userId"],
    where,
    _count: { _all: true },
    _sum: {
      inputTokens: true,
      outputTokens: true,
      totalTokens: true,
      cachedInputTokens: true,
      toolCallCount: true,
    },
    _max: { createdAt: true },
    orderBy: { _sum: { totalTokens: "desc" } },
    take: 200,
  })

  if (grouped.length === 0) return []

  const userIds = grouped.map((row) => row.userId)
  const [users, failedCounts, conversationCounts, runCounts, modelTops, providerTops, sourceTops] = await Promise.all([
    prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, email: true, displayName: true },
    }),
    prisma.aIUsageLog.groupBy({
      by: ["userId"],
      where: { ...where, status: "failed" },
      _count: { _all: true },
    }),
    prisma.aIUsageLog
      .findMany({
        where: { ...where, conversationId: { not: null }, userId: { in: userIds } },
        distinct: ["userId", "conversationId"],
        select: { userId: true, conversationId: true },
      })
      .then((rows) => {
        const counts = new Map<string, number>()
        for (const row of rows) counts.set(row.userId, (counts.get(row.userId) ?? 0) + 1)
        return counts
      }),
    prisma.aIUsageLog
      .findMany({
        where: { ...where, runId: { not: null }, userId: { in: userIds } },
        distinct: ["userId", "runId"],
        select: { userId: true, runId: true },
      })
      .then((rows) => {
        const counts = new Map<string, number>()
        for (const row of rows) counts.set(row.userId, (counts.get(row.userId) ?? 0) + 1)
        return counts
      }),
    prisma.aIUsageLog.groupBy({
      by: ["userId", "model"],
      where: { ...where, userId: { in: userIds } },
      _count: { _all: true },
      orderBy: { _count: { userId: "desc" } },
    }),
    prisma.aIUsageLog.groupBy({
      by: ["userId", "providerLabel"],
      where: { ...where, userId: { in: userIds } },
      _count: { _all: true },
      orderBy: { _count: { userId: "desc" } },
    }),
    prisma.aIUsageLog.groupBy({
      by: ["userId", "configSource"],
      where: { ...where, userId: { in: userIds } },
      _count: { _all: true },
      orderBy: { _count: { userId: "desc" } },
    }),
  ])

  const userMap = new Map(users.map((u) => [u.id, u]))
  const failedMap = new Map(failedCounts.map((row) => [row.userId, row._count._all]))

  const topByUserId = (rows: Array<{ userId: string; [key: string]: unknown; _count: { _all: number } }>, key: string) => {
    const map = new Map<string, { value: string; count: number }>()
    for (const row of rows) {
      const value = (row[key] as string) ?? ""
      if (!value) continue
      const existing = map.get(row.userId)
      if (!existing || existing.count < row._count._all) {
        map.set(row.userId, { value, count: row._count._all })
      }
    }
    return map
  }

  const topModelMap = topByUserId(modelTops as Array<{ userId: string; model: string; _count: { _all: number } }>, "model")
  const topProviderMap = topByUserId(providerTops as Array<{ userId: string; providerLabel: string; _count: { _all: number } }>, "providerLabel")
  const topSourceMap = topByUserId(sourceTops as Array<{ userId: string; configSource: string; _count: { _all: number } }>, "configSource")

  return grouped.map((row) => {
    const user = userMap.get(row.userId)
    return {
      userId: row.userId,
      email: user?.email ?? "(unknown)",
      displayName: user?.displayName ?? "",
      conversationCount: conversationCounts.get(row.userId) ?? 0,
      runCount: runCounts.get(row.userId) ?? 0,
      callCount: row._count._all,
      totalTokens: row._sum.totalTokens ?? 0,
      inputTokens: row._sum.inputTokens ?? 0,
      outputTokens: row._sum.outputTokens ?? 0,
      cachedInputTokens: row._sum.cachedInputTokens ?? 0,
      toolCallCount: row._sum.toolCallCount ?? 0,
      failedCalls: failedMap.get(row.userId) ?? 0,
      topModel: topModelMap.get(row.userId)?.value ?? null,
      topProvider: topProviderMap.get(row.userId)?.value ?? null,
      topConfigSource: topSourceMap.get(row.userId)?.value ?? null,
      lastUsedAt: row._max.createdAt ? row._max.createdAt.toISOString() : null,
    }
  })
}

export async function computeUsageByModel(filter: UsageFilter): Promise<UsageByModelItem[]> {
  const where = buildWhere(filter)
  const grouped = await prisma.aIUsageLog.groupBy({
    by: ["model", "providerLabel"],
    where,
    _count: { _all: true },
    _sum: {
      inputTokens: true,
      outputTokens: true,
      totalTokens: true,
      toolCallCount: true,
    },
    orderBy: { _sum: { totalTokens: "desc" } },
    take: 100,
  })

  if (grouped.length === 0) return []

  const userBreakdown = await prisma.aIUsageLog.findMany({
    where,
    distinct: ["model", "providerLabel", "userId"],
    select: { model: true, providerLabel: true, userId: true },
  })
  const userCountMap = new Map<string, Set<string>>()
  for (const row of userBreakdown) {
    const key = `${row.model}::${row.providerLabel}`
    if (!userCountMap.has(key)) userCountMap.set(key, new Set())
    userCountMap.get(key)!.add(row.userId)
  }

  return grouped.map((row) => {
    const key = `${row.model}::${row.providerLabel}`
    return {
      model: row.model,
      providerLabel: row.providerLabel,
      callCount: row._count._all,
      inputTokens: row._sum.inputTokens ?? 0,
      outputTokens: row._sum.outputTokens ?? 0,
      totalTokens: row._sum.totalTokens ?? 0,
      toolCallCount: row._sum.toolCallCount ?? 0,
      userCount: userCountMap.get(key)?.size ?? 0,
    }
  })
}

export async function computeUsageByConfigSource(filter: UsageFilter): Promise<UsageByConfigSourceItem[]> {
  const where = buildWhere(filter)
  const grouped = await prisma.aIUsageLog.groupBy({
    by: ["configSource"],
    where,
    _count: { _all: true },
    _sum: { totalTokens: true },
  })
  const userBreakdown = await prisma.aIUsageLog.findMany({
    where,
    distinct: ["configSource", "userId"],
    select: { configSource: true, userId: true },
  })
  const userCounts = new Map<string, Set<string>>()
  for (const row of userBreakdown) {
    if (!userCounts.has(row.configSource)) userCounts.set(row.configSource, new Set())
    userCounts.get(row.configSource)!.add(row.userId)
  }
  return grouped
    .map((row) => ({
      configSource: row.configSource,
      callCount: row._count._all,
      totalTokens: row._sum.totalTokens ?? 0,
      userCount: userCounts.get(row.configSource)?.size ?? 0,
    }))
    .sort((a, b) => b.totalTokens - a.totalTokens)
}

export async function computeUsageTimeseries(
  filter: UsageFilter,
  bucketSize: "day" | "hour" = "day",
): Promise<UsageTimeseriesPoint[]> {
  const where = buildWhere(filter)
  const rows = await prisma.aIUsageLog.findMany({
    where,
    select: {
      createdAt: true,
      inputTokens: true,
      outputTokens: true,
      totalTokens: true,
    },
    orderBy: { createdAt: "asc" },
    take: 50000,
  })

  const buckets = new Map<string, UsageTimeseriesPoint>()
  for (const row of rows) {
    const date = row.createdAt
    const key =
      bucketSize === "day"
        ? `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`
        : `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")} ${String(date.getUTCHours()).padStart(2, "0")}:00`
    const existing = buckets.get(key) ?? {
      bucket: key,
      callCount: 0,
      totalTokens: 0,
      inputTokens: 0,
      outputTokens: 0,
    }
    existing.callCount += 1
    existing.totalTokens += row.totalTokens
    existing.inputTokens += row.inputTokens
    existing.outputTokens += row.outputTokens
    buckets.set(key, existing)
  }

  return [...buckets.values()].sort((a, b) => a.bucket.localeCompare(b.bucket))
}

export async function computeUsageUserDetail(
  userId: string,
  filter: UsageFilter,
): Promise<UsageUserDetail | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, displayName: true },
  })
  if (!user) return null

  const scopedFilter: UsageFilter = { ...filter, userId }

  const [totals, modelBreakdown, configSourceBreakdown, timeline] = await Promise.all([
    computeUsageOverview(scopedFilter),
    computeUsageByModel(scopedFilter),
    computeUsageByConfigSource(scopedFilter),
    computeUsageTimeseries(scopedFilter),
  ])

  const where = buildWhere(scopedFilter)

  const conversationGroups = await prisma.aIUsageLog.groupBy({
    by: ["conversationId"],
    where: { ...where, conversationId: { not: null } },
    _count: { _all: true },
    _sum: { totalTokens: true, inputTokens: true, outputTokens: true },
    _max: { createdAt: true },
    orderBy: { _sum: { totalTokens: "desc" } },
    take: 50,
  })
  const conversationIds = conversationGroups
    .map((row) => row.conversationId)
    .filter((id): id is string => Boolean(id))
  const conversationsMeta = await prisma.aIConversation.findMany({
    where: { id: { in: conversationIds } },
    select: { id: true, title: true },
  })
  const titleMap = new Map(conversationsMeta.map((row) => [row.id, row.title]))

  const conversations = conversationGroups.map((row) => ({
    id: row.conversationId ?? "",
    title: titleMap.get(row.conversationId ?? "") ?? "(已删除会话)",
    callCount: row._count._all,
    totalTokens: row._sum.totalTokens ?? 0,
    inputTokens: row._sum.inputTokens ?? 0,
    outputTokens: row._sum.outputTokens ?? 0,
    lastUsedAt: row._max.createdAt ? row._max.createdAt.toISOString() : null,
  }))

  const toolWhere: Prisma.AIToolCallLogWhereInput = { userId }
  if (filter.from || filter.to) {
    toolWhere.startedAt = {}
    if (filter.from) (toolWhere.startedAt as Prisma.DateTimeFilter).gte = filter.from
    if (filter.to) (toolWhere.startedAt as Prisma.DateTimeFilter).lte = filter.to
  }
  const toolGroups = await prisma.aIToolCallLog.groupBy({
    by: ["toolName"],
    where: toolWhere,
    _count: { _all: true },
    _max: { startedAt: true },
    orderBy: { _count: { toolName: "desc" } },
    take: 50,
  })
  const failedTool = await prisma.aIToolCallLog.groupBy({
    by: ["toolName"],
    where: { ...toolWhere, status: "failed" },
    _count: { _all: true },
  })
  const failedToolMap = new Map(failedTool.map((row) => [row.toolName, row._count._all]))

  const toolCalls = toolGroups.map((row) => ({
    toolName: row.toolName,
    callCount: row._count._all,
    failedCount: failedToolMap.get(row.toolName) ?? 0,
    lastUsedAt: row._max.startedAt ? row._max.startedAt.toISOString() : null,
  }))

  return {
    user: { id: user.id, email: user.email, displayName: user.displayName },
    totals,
    modelBreakdown,
    configSourceBreakdown,
    timeline,
    conversations,
    toolCalls,
  }
}

export async function listProviderModelOptions(): Promise<{ providers: string[]; models: string[] }> {
  const providers = await prisma.aIUsageLog.findMany({
    distinct: ["providerLabel"],
    select: { providerLabel: true },
    where: { providerLabel: { not: "" } },
    take: 200,
  })
  const models = await prisma.aIUsageLog.findMany({
    distinct: ["model"],
    select: { model: true },
    where: { model: { not: "" } },
    take: 500,
  })
  return {
    providers: providers.map((row) => row.providerLabel).sort(),
    models: models.map((row) => row.model).sort(),
  }
}
