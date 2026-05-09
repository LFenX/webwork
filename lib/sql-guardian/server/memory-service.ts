import "server-only"

import { Prisma } from "@/app/generated/prisma/client"
import { prisma } from "@/lib/db"
import {
  evaluateGuardianMemorySafety,
  GUARDIAN_MEMORY_STATUSES,
  hasExplicitRememberIntent,
  inferGuardianMemoryType,
  normalizeMemoryText,
  shouldSkipAutomaticMemoryCandidate,
  type GuardianMemorySensitivity,
  type GuardianMemorySource,
  type GuardianMemoryStatus,
  type GuardianMemoryType,
} from "@/lib/sql-guardian/server/memory-safety"
import { GuardianServiceError, getOrCreateGuardianProfile } from "@/lib/sql-guardian/server/profile-service"
import { normalizeJsonInput } from "@/lib/sql-guardian/server/validation"

const ACTIVE_CANDIDATE_LIMIT = 100
const TOTAL_MEMORY_LIMIT = 200
const CHAT_MEMORY_LIMIT = 5

type GuardianMemoryRecord = {
  id: string
  type: string
  status: string
  source: string
  sensitivity: string
  content: string
  summary: string | null
  importance: number
  visibility: string
  metadataJson: Prisma.JsonValue | null
  lastUsedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

type CreateGuardianMemoryInput = {
  type: GuardianMemoryType
  content: string
  summary?: string
  importance?: number
}

type UpdateGuardianMemoryInput = {
  type?: GuardianMemoryType
  status?: GuardianMemoryStatus
  content?: string
  summary?: string | null
  importance?: number
}

type CandidateInput = {
  message: string
  sourceDialogueId?: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value))
}

export function isGuardianMemoryEnabled(preferencesJson: unknown) {
  return !(isRecord(preferencesJson) && preferencesJson.guardianMemoryEnabled === false)
}

function toIso(value: Date | string | null) {
  if (!value) return null
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}

function toJsonValue(value: unknown) {
  return (normalizeJsonInput(value) ?? Prisma.JsonNull) as Prisma.InputJsonValue
}

function serializeGuardianMemory(memory: GuardianMemoryRecord) {
  return {
    id: memory.id,
    type: memory.type as GuardianMemoryType,
    status: memory.status as GuardianMemoryStatus,
    source: memory.source as GuardianMemorySource,
    sensitivity: memory.sensitivity as GuardianMemorySensitivity,
    content: memory.content,
    summary: memory.summary,
    importance: memory.importance,
    visibility: memory.visibility,
    metadataJson: memory.metadataJson ?? null,
    lastUsedAt: toIso(memory.lastUsedAt),
    createdAt: toIso(memory.createdAt)!,
    updatedAt: toIso(memory.updatedAt)!,
  }
}

function clampImportance(value: number | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return 1
  return Math.max(1, Math.min(5, Math.trunc(value)))
}

function normalizeSummary(value: string | null | undefined) {
  if (value === null) return null
  if (value === undefined) return undefined
  const normalized = normalizeMemoryText(value, 160)
  return normalized || null
}

async function assertMemoryCapacity(userId: string, mode: "throw" | "skip") {
  const [activeCandidateCount, totalCount] = await Promise.all([
    prisma.guardianMemory.count({
      where: { userId, status: { in: ["active", "candidate"] } },
    }),
    prisma.guardianMemory.count({ where: { userId } }),
  ])

  const overLimit = activeCandidateCount >= ACTIVE_CANDIDATE_LIMIT || totalCount >= TOTAL_MEMORY_LIMIT
  if (!overLimit) return true
  if (mode === "skip") return false
  throw new GuardianServiceError("MEMORY_LIMIT_REACHED", "Guardian memory limit reached", 409)
}

function normalizeStatuses(status?: GuardianMemoryStatus[]) {
  const values = status?.filter((item) => GUARDIAN_MEMORY_STATUSES.includes(item)) ?? []
  return values.length ? values : ["active", "candidate"]
}

function extractCandidateContent(message: string) {
  const normalized = normalizeMemoryText(message, 700)
  const patterns = [
    /(?:请记住|帮我记住|记住我|记住[:：]?)(.+)$/i,
    /(?:以后叫我)(.+)$/i,
    /(?:我更喜欢|我喜欢)(.+)$/i,
    /(?:我正在学习)(.+)$/i,
    /(?:我的目标是)(.+)$/i,
  ]

  for (const pattern of patterns) {
    const match = normalized.match(pattern)
    const content = normalizeMemoryText(match?.[1] ?? "", 500)
    if (content) return content
  }

  return ""
}

function validateStatusTransition(currentStatus: string, nextStatus: GuardianMemoryStatus, sensitivity: GuardianMemorySensitivity) {
  if (nextStatus === currentStatus) return
  if (nextStatus === "active" && sensitivity !== "low") {
    throw new GuardianServiceError("SENSITIVE_MEMORY_REQUIRES_REVIEW", "Sensitive Guardian memory cannot become active", 400)
  }
  if (currentStatus === "candidate" && (nextStatus === "active" || nextStatus === "rejected" || nextStatus === "archived")) return
  if (currentStatus === "active" && nextStatus === "archived") return
  if (currentStatus === "archived" && nextStatus === "active" && sensitivity === "low") return
  if (currentStatus === "rejected" && nextStatus === "candidate") return
  throw new GuardianServiceError("INVALID_MEMORY_STATUS_TRANSITION", "Unsupported Guardian memory status transition", 400)
}

export async function listGuardianMemories(
  userId: string,
  input: {
    status?: GuardianMemoryStatus[]
    type?: GuardianMemoryType
    limit: number
  }
) {
  const rows = await prisma.guardianMemory.findMany({
    where: {
      userId,
      status: { in: normalizeStatuses(input.status) },
      ...(input.type ? { type: input.type } : {}),
    },
    orderBy: [{ status: "asc" }, { importance: "desc" }, { updatedAt: "desc" }],
    take: input.limit,
  })

  return { items: rows.map(serializeGuardianMemory) }
}

export async function createGuardianMemory(userId: string, input: CreateGuardianMemoryInput) {
  const profile = await getOrCreateGuardianProfile(userId)
  if (!isGuardianMemoryEnabled(profile.preferencesJson)) {
    throw new GuardianServiceError("MEMORY_DISABLED", "Guardian memory is disabled", 403)
  }
  await assertMemoryCapacity(userId, "throw")

  const content = normalizeMemoryText(input.content)
  const safety = evaluateGuardianMemorySafety(content)
  if (!safety.allowed || safety.sensitivity === "high") {
    throw new GuardianServiceError("SENSITIVE_MEMORY_REJECTED", "This content is too sensitive for Guardian memory", 400)
  }

  const status: GuardianMemoryStatus = safety.sensitivity === "low" ? "active" : "candidate"
  const created = await prisma.guardianMemory.create({
    data: {
      userId,
      guardianProfileId: profile.id,
      type: input.type,
      status,
      source: "manual",
      sensitivity: safety.sensitivity,
      content,
      summary: normalizeSummary(input.summary),
      importance: clampImportance(input.importance),
      visibility: "private",
      metadataJson: toJsonValue({
        detectedBy: "manual",
        safetyLevel: safety.sensitivity,
        safetyReason: safety.reason ?? "",
        source: "manual",
      }),
    },
  })

  return serializeGuardianMemory(created)
}

export async function updateGuardianMemory(userId: string, memoryId: string, input: UpdateGuardianMemoryInput) {
  const existing = await prisma.guardianMemory.findFirst({
    where: { id: memoryId, userId },
  })
  if (!existing) {
    throw new GuardianServiceError("MEMORY_NOT_FOUND", "Guardian memory not found", 404)
  }

  const nextContent = input.content !== undefined ? normalizeMemoryText(input.content) : existing.content
  const safety = input.content !== undefined || input.status === "active"
    ? evaluateGuardianMemorySafety(nextContent)
    : {
        allowed: true,
        sensitivity: existing.sensitivity as GuardianMemorySensitivity,
      }
  if (!safety.allowed || safety.sensitivity === "high") {
    throw new GuardianServiceError("SENSITIVE_MEMORY_REJECTED", "This content is too sensitive for Guardian memory", 400)
  }

  const nextStatus = input.status ?? (
    input.content !== undefined && existing.status === "active" && safety.sensitivity !== "low"
      ? "candidate"
      : existing.status as GuardianMemoryStatus
  )
  validateStatusTransition(existing.status, nextStatus, safety.sensitivity)

  const updated = await prisma.guardianMemory.update({
    where: { id: existing.id },
    data: {
      ...(input.type !== undefined ? { type: input.type } : {}),
      ...(input.content !== undefined ? { content: nextContent } : {}),
      ...(input.summary !== undefined ? { summary: normalizeSummary(input.summary) } : {}),
      ...(input.importance !== undefined ? { importance: clampImportance(input.importance) } : {}),
      status: nextStatus,
      sensitivity: safety.sensitivity,
      ...(nextStatus === "active" && existing.source === "guardianChat" ? { source: "userConfirmed" } : {}),
      metadataJson: toJsonValue({
        ...(isRecord(existing.metadataJson) ? existing.metadataJson : {}),
        safetyLevel: safety.sensitivity,
        safetyReason: safety.reason ?? "",
      }),
    },
  })

  return serializeGuardianMemory(updated)
}

export async function deleteGuardianMemory(userId: string, memoryId: string) {
  const existing = await prisma.guardianMemory.findFirst({
    where: { id: memoryId, userId },
    select: { id: true },
  })
  if (!existing) {
    throw new GuardianServiceError("MEMORY_NOT_FOUND", "Guardian memory not found", 404)
  }
  await prisma.guardianMemory.delete({ where: { id: existing.id } })
  return { deleted: true, id: existing.id }
}

export async function selectMemoriesForGuardianChat(userId: string) {
  const profile = await getOrCreateGuardianProfile(userId)
  if (!isGuardianMemoryEnabled(profile.preferencesJson)) return []

  const rows = await prisma.guardianMemory.findMany({
    where: {
      userId,
      status: "active",
      sensitivity: { in: ["low", "medium"] },
    },
    orderBy: [{ importance: "desc" }, { lastUsedAt: "asc" }, { updatedAt: "desc" }],
    take: CHAT_MEMORY_LIMIT,
  })

  return rows.map(serializeGuardianMemory)
}

export async function markGuardianMemoriesUsed(userId: string, memoryIds: string[]) {
  const ids = [...new Set(memoryIds)].filter(Boolean).slice(0, CHAT_MEMORY_LIMIT)
  if (!ids.length) return
  await prisma.guardianMemory.updateMany({
    where: { userId, id: { in: ids }, status: "active" },
    data: { lastUsedAt: new Date() },
  })
}

export async function maybeCreateGuardianMemoryCandidate(userId: string, input: CandidateInput) {
  const profile = await getOrCreateGuardianProfile(userId)
  if (!isGuardianMemoryEnabled(profile.preferencesJson)) return null
  if (!(await assertMemoryCapacity(userId, "skip"))) return null
  if (shouldSkipAutomaticMemoryCandidate(input.message)) return null
  if (!hasExplicitRememberIntent(input.message)) return null

  const content = extractCandidateContent(input.message)
  if (!content) return null

  const safety = evaluateGuardianMemorySafety(content)
  if (!safety.allowed || safety.sensitivity === "high") return null

  const created = await prisma.guardianMemory.create({
    data: {
      userId,
      guardianProfileId: profile.id,
      type: inferGuardianMemoryType(input.message),
      status: "candidate",
      source: "guardianChat",
      sensitivity: safety.sensitivity,
      content,
      summary: null,
      importance: 2,
      visibility: "private",
      metadataJson: toJsonValue({
        sourceDialogueId: input.sourceDialogueId ?? "",
        detectedBy: "rules",
        safetyLevel: safety.sensitivity,
        safetyReason: safety.reason ?? "",
        source: "guardianChat",
      }),
    },
  })

  return serializeGuardianMemory(created)
}
