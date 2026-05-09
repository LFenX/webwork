import "server-only"

import { Prisma } from "@/app/generated/prisma/client"
import { prisma } from "@/lib/db"
import { GuardianServiceError, getOrCreateGuardianProfile } from "@/lib/sql-guardian/server/profile-service"
import {
  checkSharedMemorySummarySafety,
  checkSourceMemoryShareSafety,
  isLikelyRawMemoryCopy,
  normalizeSharedSummary,
  type GuardianMemoryBridgeDirection,
  type GuardianMemoryBridgeSharedType,
  type GuardianMemoryBridgeStatus,
} from "@/lib/sql-guardian/server/shared-memory-safety"
import { normalizeJsonInput } from "@/lib/sql-guardian/server/validation"

const SHARED_SUMMARY_LIMIT = 3

type BridgeRecord = {
  id: string
  direction: string
  sourceType: string
  sourceId: string
  target: string
  type: string
  status: string
  sharedSummary: string
  sensitivity: string
  lastReadAt: Date | null
  readCount: number
  createdAt: Date
  updatedAt: Date
  revokedAt: Date | null
}

type MemoryBridgeSettings = {
  soulwingToGuardianMemoryBridgeEnabled: boolean
  guardianToSoulWingMemoryBridgeEnabled: boolean
}

type BridgeSettingsInput = Partial<MemoryBridgeSettings>

type BridgeListInput = {
  status?: GuardianMemoryBridgeStatus[]
  direction?: GuardianMemoryBridgeDirection
}

type BridgeShareInput = {
  direction: "soulwing_to_guardian"
  sourceType: "soulwingMemoryFact"
  sourceId: string
  target: "guardian"
  type: GuardianMemoryBridgeSharedType
  sharedSummary: string
  sensitivity: "low"
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value))
}

function toJsonValue(value: unknown) {
  return (normalizeJsonInput(value) ?? Prisma.JsonNull) as Prisma.InputJsonValue
}

function toIso(value: Date | string | null) {
  if (!value) return null
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}

function normalizeBridgeSettings(preferencesJson: unknown): MemoryBridgeSettings {
  const preferences = isRecord(preferencesJson) ? preferencesJson : {}
  return {
    soulwingToGuardianMemoryBridgeEnabled: preferences.soulwingToGuardianMemoryBridgeEnabled === true,
    guardianToSoulWingMemoryBridgeEnabled: preferences.guardianToSoulWingMemoryBridgeEnabled === true,
  }
}

function serializeBridge(record: BridgeRecord) {
  return {
    id: record.id,
    direction: record.direction as GuardianMemoryBridgeDirection,
    sourceType: record.sourceType,
    sourceId: record.sourceId,
    target: record.target,
    type: record.type as GuardianMemoryBridgeSharedType,
    status: record.status as GuardianMemoryBridgeStatus,
    sharedSummary: record.sharedSummary,
    sensitivity: record.sensitivity as "low",
    lastReadAt: toIso(record.lastReadAt),
    readCount: record.readCount,
    createdAt: toIso(record.createdAt)!,
    updatedAt: toIso(record.updatedAt)!,
    revokedAt: toIso(record.revokedAt),
  }
}

async function getSoulWingMemoryAvailability(userId: string) {
  const settings = await prisma.memorySettings.findUnique({
    where: { userId },
    select: {
      enableLongTermMemory: true,
      enableMemoryRecall: true,
    },
  })

  if (!settings) return true
  return settings.enableLongTermMemory && settings.enableMemoryRecall
}

export async function recordGuardianMemoryBridgeAudit(input: {
  userId: string
  bridgeId?: string | null
  action: "share" | "revoke" | "settings_update"
  direction?: string | null
  sourceType?: string | null
  sourceId?: string | null
  target?: string | null
  type?: string | null
  status?: string | null
  metadataJson?: Record<string, unknown>
}) {
  await prisma.guardianMemoryBridgeAuditLog.create({
    data: {
      userId: input.userId,
      bridgeId: input.bridgeId ?? null,
      action: input.action,
      direction: input.direction ?? null,
      sourceType: input.sourceType ?? null,
      sourceId: input.sourceId ?? null,
      target: input.target ?? null,
      type: input.type ?? null,
      status: input.status ?? null,
      metadataJson: input.metadataJson ? toJsonValue(input.metadataJson) : Prisma.JsonNull,
    },
  })
}

export async function getGuardianMemoryBridgeSettings(userId: string) {
  const [profile, soulWingMemoryAvailable] = await Promise.all([
    getOrCreateGuardianProfile(userId),
    getSoulWingMemoryAvailability(userId),
  ])

  return {
    settings: normalizeBridgeSettings(profile.preferencesJson),
    soulWingMemoryAvailable,
  }
}

export async function updateGuardianMemoryBridgeSettings(userId: string, input: BridgeSettingsInput) {
  const profile = await getOrCreateGuardianProfile(userId)
  const existingPreferences = isRecord(profile.preferencesJson) ? profile.preferencesJson : {}
  const nextPreferences = {
    ...existingPreferences,
    ...(input.soulwingToGuardianMemoryBridgeEnabled !== undefined
      ? { soulwingToGuardianMemoryBridgeEnabled: input.soulwingToGuardianMemoryBridgeEnabled }
      : {}),
    ...(input.guardianToSoulWingMemoryBridgeEnabled !== undefined
      ? { guardianToSoulWingMemoryBridgeEnabled: input.guardianToSoulWingMemoryBridgeEnabled }
      : {}),
  }

  await prisma.guardianProfile.update({
    where: { id: profile.id },
    data: { preferencesJson: toJsonValue(nextPreferences) },
  })

  await recordGuardianMemoryBridgeAudit({
    userId,
    action: "settings_update",
    metadataJson: {
      soulwingToGuardianMemoryBridgeEnabled: nextPreferences.soulwingToGuardianMemoryBridgeEnabled === true,
      guardianToSoulWingMemoryBridgeEnabled: nextPreferences.guardianToSoulWingMemoryBridgeEnabled === true,
    },
  })

  return getGuardianMemoryBridgeSettings(userId)
}

export async function listGuardianMemoryBridges(userId: string, input: BridgeListInput) {
  const statuses = input.status?.length ? input.status : ["active"]
  const rows = await prisma.guardianMemoryBridge.findMany({
    where: {
      userId,
      status: { in: statuses },
      ...(input.direction ? { direction: input.direction } : {}),
    },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
  })

  return { items: rows.map(serializeBridge) }
}

export async function createSoulWingToGuardianBridge(userId: string, input: BridgeShareInput) {
  const source = await prisma.memoryFact.findFirst({
    where: {
      id: input.sourceId,
      userId,
      deletedAt: null,
    },
    select: {
      id: true,
      category: true,
      title: true,
      content: true,
      importance: true,
    },
  })
  if (!source) {
    throw new GuardianServiceError("SOURCE_MEMORY_NOT_FOUND", "Source memory was not found", 404)
  }

  const soulWingMemoryAvailable = await getSoulWingMemoryAvailability(userId)
  if (!soulWingMemoryAvailable) {
    throw new GuardianServiceError("SOULWING_MEMORY_DISABLED", "SoulWing memory recall is disabled", 403)
  }

  const sharedSummary = normalizeSharedSummary(input.sharedSummary)
  const sourceSafety = checkSourceMemoryShareSafety(`${source.title}\n${source.content}`)
  const summarySafety = checkSharedMemorySummarySafety(sharedSummary)
  if (!sourceSafety.allowed || sourceSafety.sensitivity !== "low") {
    throw new GuardianServiceError("SENSITIVE_SOURCE_MEMORY_REJECTED", "Source memory is too sensitive to share", 400)
  }
  if (!summarySafety.allowed || summarySafety.sensitivity !== "low") {
    throw new GuardianServiceError("SENSITIVE_SHARED_SUMMARY_REJECTED", "Shared summary is too sensitive", 400)
  }
  if (isLikelyRawMemoryCopy(sharedSummary, source.content)) {
    throw new GuardianServiceError("RAW_MEMORY_COPY_REJECTED", "Shared summary is too similar to the raw memory", 400)
  }

  const existing = await prisma.guardianMemoryBridge.findFirst({
    where: {
      userId,
      direction: "soulwing_to_guardian",
      sourceType: "soulwingMemoryFact",
      sourceId: source.id,
      target: "guardian",
      status: "active",
    },
  })

  const bridge = existing
    ? await prisma.guardianMemoryBridge.update({
        where: { id: existing.id },
        data: {
          type: input.type,
          sharedSummary,
          sensitivity: "low",
          revokedAt: null,
        },
      })
    : await prisma.guardianMemoryBridge.create({
        data: {
          userId,
          direction: "soulwing_to_guardian",
          sourceType: "soulwingMemoryFact",
          sourceId: source.id,
          target: "guardian",
          type: input.type,
          status: "active",
          sharedSummary,
          sensitivity: "low",
        },
      })

  await recordGuardianMemoryBridgeAudit({
    userId,
    bridgeId: bridge.id,
    action: "share",
    direction: bridge.direction,
    sourceType: bridge.sourceType,
    sourceId: bridge.sourceId,
    target: bridge.target,
    type: bridge.type,
    status: bridge.status,
    metadataJson: {
      sourceCategory: source.category,
      sourceImportance: source.importance,
      summaryLength: sharedSummary.length,
      updatedExisting: Boolean(existing),
    },
  })

  return { bridge: serializeBridge(bridge) }
}

export async function revokeGuardianMemoryBridge(userId: string, bridgeId: string) {
  const existing = await prisma.guardianMemoryBridge.findFirst({
    where: { id: bridgeId, userId },
  })
  if (!existing) {
    throw new GuardianServiceError("BRIDGE_NOT_FOUND", "Shared memory bridge was not found", 404)
  }

  const revoked = await prisma.guardianMemoryBridge.update({
    where: { id: existing.id },
    data: {
      status: "revoked",
      revokedAt: new Date(),
    },
  })

  await recordGuardianMemoryBridgeAudit({
    userId,
    bridgeId: revoked.id,
    action: "revoke",
    direction: revoked.direction,
    sourceType: revoked.sourceType,
    sourceId: revoked.sourceId,
    target: revoked.target,
    type: revoked.type,
    status: revoked.status,
  })

  return { bridge: serializeBridge(revoked) }
}

export async function selectSoulWingSharedSummariesForGuardian(userId: string) {
  try {
    const [profile, soulWingMemoryAvailable] = await Promise.all([
      getOrCreateGuardianProfile(userId),
      getSoulWingMemoryAvailability(userId),
    ])
    const settings = normalizeBridgeSettings(profile.preferencesJson)
    if (!settings.soulwingToGuardianMemoryBridgeEnabled || !soulWingMemoryAvailable) return []

    const rows = await prisma.guardianMemoryBridge.findMany({
      where: {
        userId,
        direction: "soulwing_to_guardian",
        target: "guardian",
        status: "active",
        sensitivity: "low",
      },
      orderBy: [{ lastReadAt: "asc" }, { updatedAt: "desc" }],
      take: SHARED_SUMMARY_LIMIT,
    })

    if (rows.length) {
      await prisma.guardianMemoryBridge.updateMany({
        where: { userId, id: { in: rows.map((row) => row.id) }, status: "active" },
        data: {
          lastReadAt: new Date(),
          readCount: { increment: 1 },
        },
      }).catch(() => undefined)
    }

    return rows.map(serializeBridge)
  } catch {
    return []
  }
}
