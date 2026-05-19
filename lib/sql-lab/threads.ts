import "server-only"

import { Prisma } from "@/app/generated/prisma/client"
import { prisma } from "@/lib/db"
import type {
  SqlThreadDetail,
  SqlThreadStep,
  SqlThreadStepKind,
  SqlThreadStepStatus,
  SqlThreadSummary,
} from "@/lib/sql-lab/types"

const DEFAULT_TITLE = "New analysis"

function asPayload(value: Prisma.JsonValue | null): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function asStep(row: {
  id: string
  threadId: string
  orderIndex: number
  kind: string
  status: string
  title: string
  bodyMarkdown: string
  sql: string
  payload: Prisma.JsonValue | null
  tokensIn: number
  tokensOut: number
  durationMs: number
  errorMessage: string | null
  createdAt: Date
}): SqlThreadStep {
  return {
    id: row.id,
    threadId: row.threadId,
    orderIndex: row.orderIndex,
    kind: row.kind as SqlThreadStepKind,
    status: (row.status as SqlThreadStepStatus) ?? "done",
    title: row.title,
    bodyMarkdown: row.bodyMarkdown,
    sql: row.sql,
    payload: asPayload(row.payload),
    tokensIn: row.tokensIn,
    tokensOut: row.tokensOut,
    durationMs: row.durationMs,
    errorMessage: row.errorMessage ?? undefined,
    createdAt: row.createdAt.toISOString(),
  }
}

function asSummary(row: {
  id: string
  title: string
  summary: string
  modelName: string
  status: string
  pinned: boolean
  archivedAt: Date | null
  lastEventAt: Date
  createdAt: Date
  updatedAt: Date
  _count: { steps: number }
}): SqlThreadSummary {
  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    modelName: row.modelName,
    status: row.status,
    pinned: row.pinned,
    archived: Boolean(row.archivedAt),
    lastEventAt: row.lastEventAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    stepCount: row._count.steps,
  }
}

function trimTitle(value: string) {
  return value.trim().replace(/\s+/g, " ").slice(0, 40)
}

function deriveTitle(prompt: string) {
  const compact = trimTitle(prompt.replace(/```[\s\S]*?```/g, "SQL").replace(/[?？。！!]+$/g, ""))
  return compact || DEFAULT_TITLE
}

export async function listSqlThreads(userId: string, { archived = false } = {}): Promise<SqlThreadSummary[]> {
  const rows = await prisma.sqlThread.findMany({
    where: { userId, ...(archived ? {} : { archivedAt: null }) },
    orderBy: [{ pinned: "desc" }, { lastEventAt: "desc" }],
    take: 40,
    include: { _count: { select: { steps: true } } },
  })
  return rows.map(asSummary)
}

export async function getSqlThreadDetail(userId: string, threadId: string): Promise<SqlThreadDetail> {
  const row = await prisma.sqlThread.findFirst({
    where: { id: threadId, userId },
    include: {
      _count: { select: { steps: true } },
      steps: { orderBy: { orderIndex: "asc" } },
    },
  })
  if (!row) throw new Error("Stage thread not found")
  return {
    ...asSummary(row),
    steps: row.steps.map(asStep),
  }
}

export async function createSqlThread(
  userId: string,
  input: { title?: string; prompt?: string; modelName?: string } = {},
): Promise<SqlThreadSummary> {
  const baseTitle = input.title?.trim() || (input.prompt ? deriveTitle(input.prompt) : DEFAULT_TITLE)
  const row = await prisma.sqlThread.create({
    data: {
      userId,
      title: baseTitle,
      modelName: input.modelName ?? "",
    },
    include: { _count: { select: { steps: true } } },
  })
  return asSummary(row)
}

export async function renameSqlThread(userId: string, threadId: string, title: string): Promise<SqlThreadSummary> {
  const nextTitle = trimTitle(title)
  if (!nextTitle) throw new Error("Thread title cannot be empty")
  const existing = await prisma.sqlThread.findFirst({ where: { id: threadId, userId }, select: { id: true } })
  if (!existing) throw new Error("Stage thread not found")
  const updated = await prisma.sqlThread.update({
    where: { id: threadId },
    data: { title: nextTitle, titleLocked: true },
    include: { _count: { select: { steps: true } } },
  })
  return asSummary(updated)
}

export async function archiveSqlThread(userId: string, threadId: string): Promise<void> {
  const existing = await prisma.sqlThread.findFirst({ where: { id: threadId, userId }, select: { id: true } })
  if (!existing) throw new Error("Stage thread not found")
  await prisma.sqlThread.update({
    where: { id: threadId },
    data: { archivedAt: new Date() },
  })
}

export async function setThreadPinned(userId: string, threadId: string, pinned: boolean): Promise<SqlThreadSummary> {
  const existing = await prisma.sqlThread.findFirst({ where: { id: threadId, userId }, select: { id: true } })
  if (!existing) throw new Error("Stage thread not found")
  const updated = await prisma.sqlThread.update({
    where: { id: threadId },
    data: { pinned },
    include: { _count: { select: { steps: true } } },
  })
  return asSummary(updated)
}

export async function deleteSqlThread(userId: string, threadId: string): Promise<void> {
  const existing = await prisma.sqlThread.findFirst({ where: { id: threadId, userId }, select: { id: true } })
  if (!existing) throw new Error("Stage thread not found")
  await prisma.sqlThread.delete({ where: { id: threadId } })
}

export type AppendStepInput = {
  threadId: string
  kind: SqlThreadStepKind
  status?: SqlThreadStepStatus
  title?: string
  bodyMarkdown?: string
  sql?: string
  payload?: unknown
  tokensIn?: number
  tokensOut?: number
  durationMs?: number
  errorMessage?: string | null
}

function toJsonInput(value: unknown): Prisma.InputJsonValue {
  return (value ?? Prisma.JsonNull) as Prisma.InputJsonValue
}

export async function appendThreadStep(userId: string, input: AppendStepInput): Promise<SqlThreadStep> {
  const thread = await prisma.sqlThread.findFirst({
    where: { id: input.threadId, userId },
    select: { id: true, titleLocked: true, title: true },
  })
  if (!thread) throw new Error("Stage thread not found")
  const last = await prisma.sqlThreadStep.findFirst({
    where: { threadId: thread.id },
    orderBy: { orderIndex: "desc" },
    select: { orderIndex: true },
  })
  const orderIndex = (last?.orderIndex ?? -1) + 1
  const now = new Date()
  const created = await prisma.sqlThreadStep.create({
    data: {
      threadId: thread.id,
      userId,
      orderIndex,
      kind: input.kind,
      status: input.status ?? "done",
      title: input.title ?? "",
      bodyMarkdown: input.bodyMarkdown ?? "",
      sql: input.sql ?? "",
      payload: toJsonInput(input.payload),
      tokensIn: input.tokensIn ?? 0,
      tokensOut: input.tokensOut ?? 0,
      durationMs: input.durationMs ?? 0,
      errorMessage: input.errorMessage ?? null,
    },
  })
  await prisma.sqlThread.update({
    where: { id: thread.id },
    data: {
      lastEventAt: now,
      status: input.status === "error" ? "error" : input.status === "running" ? "running" : "idle",
    },
  })
  if (input.kind === "user_prompt" && !thread.titleLocked && (!thread.title || thread.title === DEFAULT_TITLE)) {
    const candidate = deriveTitle(input.bodyMarkdown ?? "")
    if (candidate && candidate !== DEFAULT_TITLE) {
      await prisma.sqlThread.update({ where: { id: thread.id }, data: { title: candidate } })
    }
  }
  return asStep(created)
}

export type UpdateStepInput = {
  stepId: string
  status?: SqlThreadStepStatus
  title?: string
  bodyMarkdown?: string
  bodyDelta?: string
  sql?: string
  payload?: unknown
  payloadPatch?: Record<string, unknown>
  tokensIn?: number
  tokensOut?: number
  durationMs?: number
  errorMessage?: string | null
}

export async function updateThreadStep(userId: string, input: UpdateStepInput): Promise<SqlThreadStep> {
  const existing = await prisma.sqlThreadStep.findFirst({
    where: { id: input.stepId, userId },
  })
  if (!existing) throw new Error("Stage step not found")

  const data: Prisma.SqlThreadStepUpdateInput = {}
  if (input.status !== undefined) data.status = input.status
  if (input.title !== undefined) data.title = input.title
  if (input.bodyMarkdown !== undefined) {
    data.bodyMarkdown = input.bodyMarkdown
  } else if (input.bodyDelta) {
    data.bodyMarkdown = (existing.bodyMarkdown ?? "") + input.bodyDelta
  }
  if (input.sql !== undefined) data.sql = input.sql
  if (input.payload !== undefined) {
    data.payload = toJsonInput(input.payload)
  } else if (input.payloadPatch) {
    const merged = { ...(asPayload(existing.payload) ?? {}), ...input.payloadPatch }
    data.payload = toJsonInput(merged)
  }
  if (input.tokensIn !== undefined) data.tokensIn = input.tokensIn
  if (input.tokensOut !== undefined) data.tokensOut = input.tokensOut
  if (input.durationMs !== undefined) data.durationMs = input.durationMs
  if (input.errorMessage !== undefined) data.errorMessage = input.errorMessage

  const updated = await prisma.sqlThreadStep.update({
    where: { id: input.stepId },
    data,
  })
  return asStep(updated)
}

export async function setThreadStatus(threadId: string, status: string): Promise<void> {
  await prisma.sqlThread.update({
    where: { id: threadId },
    data: { status, lastEventAt: new Date() },
  })
}
