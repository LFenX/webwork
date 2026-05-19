import "server-only"
import { prisma } from "@/lib/db"
import type { CreatePracticeProblemInput, UpdatePracticeProblemInput } from "./validators"

const CHINA_TZ = "Asia/Shanghai"

function chinaDateKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: CHINA_TZ }).format(date)
}

export async function createProblem(userId: string, input: CreatePracticeProblemInput) {
  return prisma.sqlPracticeProblem.create({
    data: {
      userId,
      title: input.title.trim(),
      source: input.source,
      sourceUrl: input.sourceUrl ?? "",
      difficulty: input.difficulty,
      tags: input.tags ?? [],
      methods: input.methods ?? [],
      durationMinutes: input.durationMinutes ?? 0,
      notes: input.notes ?? "",
      code: input.code ?? "",
      practicedAt: input.practicedAt ? new Date(input.practicedAt) : new Date(),
    },
  })
}

export async function updateProblem(userId: string, id: string, input: UpdatePracticeProblemInput) {
  const existing = await prisma.sqlPracticeProblem.findUnique({ where: { id } })
  if (!existing || existing.userId !== userId) return null
  return prisma.sqlPracticeProblem.update({
    where: { id },
    data: {
      ...(input.title !== undefined && { title: input.title.trim() }),
      ...(input.source !== undefined && { source: input.source }),
      ...(input.sourceUrl !== undefined && { sourceUrl: input.sourceUrl }),
      ...(input.difficulty !== undefined && { difficulty: input.difficulty }),
      ...(input.tags !== undefined && { tags: input.tags }),
      ...(input.methods !== undefined && { methods: input.methods }),
      ...(input.durationMinutes !== undefined && { durationMinutes: input.durationMinutes }),
      ...(input.notes !== undefined && { notes: input.notes }),
      ...(input.code !== undefined && { code: input.code }),
      ...(input.practicedAt !== undefined && { practicedAt: new Date(input.practicedAt) }),
    },
  })
}

export async function deleteProblem(userId: string, id: string) {
  const existing = await prisma.sqlPracticeProblem.findUnique({ where: { id } })
  if (!existing || existing.userId !== userId) return false
  await prisma.sqlPracticeProblem.delete({ where: { id } })
  return true
}

export type ProblemFilter = {
  from?: Date
  to?: Date
  difficulty?: string
  source?: string
  tag?: string
  method?: string
  q?: string
}

export async function listProblems(userId: string, filter: ProblemFilter = {}, take = 200) {
  const where: Record<string, unknown> = { userId }
  if (filter.difficulty) where.difficulty = filter.difficulty
  if (filter.source) where.source = filter.source
  if (filter.tag) where.tags = { has: filter.tag }
  if (filter.method) where.methods = { has: filter.method }
  if (filter.from || filter.to) {
    const range: Record<string, Date> = {}
    if (filter.from) range.gte = filter.from
    if (filter.to) range.lte = filter.to
    where.practicedAt = range
  }
  if (filter.q && filter.q.trim()) {
    const q = filter.q.trim()
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { notes: { contains: q, mode: "insensitive" } },
    ]
  }
  return prisma.sqlPracticeProblem.findMany({
    where,
    orderBy: [{ practicedAt: "desc" }, { createdAt: "desc" }],
    take,
  })
}

export type PracticeStats = {
  total: number
  today: number
  last7Days: number
  last30Days: number
  totalMinutes: number
  byDifficulty: Array<{ key: string; count: number }>
  bySource: Array<{ key: string; count: number }>
  byTag: Array<{ key: string; count: number }>
  byMethod: Array<{ key: string; count: number }>
  daily: Array<{ date: string; count: number }>
}

export async function getStats(userId: string, days = 30): Promise<PracticeStats> {
  const since = new Date()
  since.setDate(since.getDate() - 90)
  const records = await prisma.sqlPracticeProblem.findMany({
    where: { userId },
    select: {
      practicedAt: true,
      difficulty: true,
      source: true,
      tags: true,
      methods: true,
      durationMinutes: true,
    },
  })

  const totalCount = records.length
  const total7 = new Date()
  total7.setDate(total7.getDate() - 7)
  const total30 = new Date()
  total30.setDate(total30.getDate() - 30)
  const todayKey = chinaDateKey(new Date())

  let todayCount = 0
  let last7 = 0
  let last30 = 0
  let totalMinutes = 0
  const difficultyMap = new Map<string, number>()
  const sourceMap = new Map<string, number>()
  const tagMap = new Map<string, number>()
  const methodMap = new Map<string, number>()
  const dailyMap = new Map<string, number>()

  for (const rec of records) {
    totalMinutes += rec.durationMinutes
    const key = chinaDateKey(rec.practicedAt)
    if (key === todayKey) todayCount++
    if (rec.practicedAt >= total7) last7++
    if (rec.practicedAt >= total30) last30++

    difficultyMap.set(rec.difficulty, (difficultyMap.get(rec.difficulty) ?? 0) + 1)
    sourceMap.set(rec.source, (sourceMap.get(rec.source) ?? 0) + 1)
    for (const tag of rec.tags) tagMap.set(tag, (tagMap.get(tag) ?? 0) + 1)
    for (const m of rec.methods) methodMap.set(m, (methodMap.get(m) ?? 0) + 1)
    dailyMap.set(key, (dailyMap.get(key) ?? 0) + 1)
  }

  // Build daily series for trailing `days` days, including zero-fill
  const daily: Array<{ date: string; count: number }> = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const key = chinaDateKey(d)
    daily.push({ date: key, count: dailyMap.get(key) ?? 0 })
  }

  const toSortedArr = (m: Map<string, number>) =>
    Array.from(m.entries())
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => b.count - a.count)

  return {
    total: totalCount,
    today: todayCount,
    last7Days: last7,
    last30Days: last30,
    totalMinutes,
    byDifficulty: toSortedArr(difficultyMap),
    bySource: toSortedArr(sourceMap),
    byTag: toSortedArr(tagMap),
    byMethod: toSortedArr(methodMap),
    daily,
  }
}

export type GrantRow = {
  userId: string
  email: string
  displayName: string
  role: string
  enabled: boolean
  note: string
  updatedAt: Date | null
  updatedById: string | null
}

export async function listGrants(): Promise<GrantRow[]> {
  // List all non-owner users, joined with grant info
  const users = await prisma.user.findMany({
    where: { role: { not: "owner" } },
    select: {
      id: true,
      email: true,
      displayName: true,
      role: true,
      sqlPracticeAccessGrant: {
        select: { enabled: true, note: true, updatedAt: true, updatedById: true },
      },
    },
    orderBy: [{ role: "asc" }, { email: "asc" }],
  })
  return users.map((u) => ({
    userId: u.id,
    email: u.email,
    displayName: u.displayName,
    role: u.role,
    enabled: u.sqlPracticeAccessGrant?.enabled ?? false,
    note: u.sqlPracticeAccessGrant?.note ?? "",
    updatedAt: u.sqlPracticeAccessGrant?.updatedAt ?? null,
    updatedById: u.sqlPracticeAccessGrant?.updatedById ?? null,
  }))
}

export async function upsertGrant(
  targetUserId: string,
  actorId: string,
  data: { enabled: boolean; note?: string }
) {
  return prisma.sqlPracticeAccessGrant.upsert({
    where: { userId: targetUserId },
    update: {
      enabled: data.enabled,
      note: data.note ?? "",
      updatedById: actorId,
    },
    create: {
      userId: targetUserId,
      enabled: data.enabled,
      note: data.note ?? "",
      updatedById: actorId,
    },
  })
}
