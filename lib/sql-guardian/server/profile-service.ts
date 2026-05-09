import crypto from "node:crypto"
import { Prisma } from "@/app/generated/prisma/client"
import { prisma } from "@/lib/db"
import {
  getGuardianEventCooldownMs,
  getGuardianEventExp,
  getGuardianMoodAfterEvent,
  isGuardianServerEventType,
  type GuardianServerEventType,
} from "@/lib/sql-guardian/server/events"
import {
  getExpProgress,
  getGuardianFormStage,
  getGuardianLevelFromExp,
  getGuardianTitle,
} from "@/lib/sql-guardian/server/progression"
import { normalizeJsonInput, type UpdateGuardianProfileInput } from "@/lib/sql-guardian/server/validation"

export const DEFAULT_GUARDIAN_PERSONALITY = {
  curiosity: 65,
  warmth: 55,
  mischief: 35,
  rigor: 70,
  patience: 60,
  melancholy: 30,
  bravery: 50,
  sqlPurism: 65,
} as const

export const DEFAULT_GUARDIAN_PREFERENCES = {
  dockMode: "docked",
  reducedMotionAware: true,
  autoBubbleInSqlLab: false,
  guardianMemoryEnabled: true,
} as const

type GuardianProfileRecord = Awaited<ReturnType<typeof getOrCreateGuardianProfile>>

export class GuardianServiceError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400
  ) {
    super(message)
  }
}

function toJsonValue(value: unknown) {
  return (normalizeJsonInput(value) ?? Prisma.JsonNull) as Prisma.InputJsonValue
}

function toOptionalJsonValue(value: unknown) {
  if (value === undefined) return undefined
  return toJsonValue(value)
}

function toIso(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value))
}

function avatarSeedForUser(userId: string) {
  return crypto
    .createHash("sha256")
    .update(`${userId}:${Date.now()}:${crypto.randomUUID()}`)
    .digest("hex")
    .slice(0, 24)
}

function normalizeEventType(eventType: string): GuardianServerEventType {
  if (!isGuardianServerEventType(eventType)) {
    throw new GuardianServiceError("INVALID_EVENT_TYPE", "Unsupported Guardian event type")
  }
  return eventType
}

function serializeProfile(profile: {
  id: string
  name: string
  title: string
  avatarSeed: string
  level: number
  exp: number
  formStage: string
  mood: string
  personalityJson: Prisma.JsonValue | null
  preferencesJson: Prisma.JsonValue | null
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: profile.id,
    name: profile.name,
    title: profile.title,
    level: profile.level,
    exp: profile.exp,
    formStage: profile.formStage,
    mood: profile.mood,
    avatarSeed: profile.avatarSeed,
    personality: isRecord(profile.personalityJson) ? profile.personalityJson : DEFAULT_GUARDIAN_PERSONALITY,
    preferences: isRecord(profile.preferencesJson) ? profile.preferencesJson : DEFAULT_GUARDIAN_PREFERENCES,
    createdAt: toIso(profile.createdAt),
    updatedAt: toIso(profile.updatedAt),
  }
}

function serializeEvent(event: {
  id: string
  eventType: string
  source: string | null
  pagePath: string | null
  expDelta: number
  eventPayloadJson: Prisma.JsonValue | null
  createdAt: Date
}) {
  return {
    id: event.id,
    eventType: event.eventType,
    source: event.source,
    pagePath: event.pagePath,
    expDelta: event.expDelta,
    eventPayloadJson: event.eventPayloadJson ?? null,
    createdAt: toIso(event.createdAt),
  }
}

export function serializeGuardianProfileResponse(profile: GuardianProfileRecord) {
  return {
    profile: serializeProfile(profile),
    progress: getExpProgress(profile.exp),
  }
}

export async function getOrCreateGuardianProfile(userId: string) {
  return prisma.guardianProfile.upsert({
    where: { userId },
    update: {},
    create: {
      userId,
      name: "Query",
      title: getGuardianTitle(1),
      avatarSeed: avatarSeedForUser(userId),
      level: 1,
      exp: 0,
      formStage: getGuardianFormStage(1),
      mood: "curious",
      personalityJson: toJsonValue(DEFAULT_GUARDIAN_PERSONALITY),
      preferencesJson: toJsonValue(DEFAULT_GUARDIAN_PREFERENCES),
    },
  })
}

export async function updateGuardianProfile(userId: string, input: UpdateGuardianProfileInput) {
  const current = await getOrCreateGuardianProfile(userId)
  const existingPreferences = isRecord(current.preferencesJson) ? current.preferencesJson : DEFAULT_GUARDIAN_PREFERENCES
  const preferencesJson = input.preferencesJson
    ? toOptionalJsonValue({ ...existingPreferences, ...input.preferencesJson })
    : undefined

  return prisma.guardianProfile.update({
    where: { userId },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.mood !== undefined ? { mood: input.mood } : {}),
      ...(preferencesJson !== undefined ? { preferencesJson } : {}),
    },
  })
}

export async function listGuardianEvents(
  userId: string,
  input: {
    limit: number
    cursor?: string
  }
) {
  const rows = await prisma.guardianEvent.findMany({
    where: { userId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: input.limit + 1,
    ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
  })
  const items = rows.slice(0, input.limit).map(serializeEvent)
  const nextCursor = rows.length > input.limit ? rows[input.limit]?.id : null

  return {
    items,
    nextCursor,
  }
}

export async function recordGuardianEvent(
  userId: string,
  input: {
    eventType: string
    source?: string
    pagePath?: string
    eventPayloadJson?: unknown
  }
) {
  const eventType = normalizeEventType(input.eventType)

  return prisma.$transaction(async (tx) => {
    const profile = await tx.guardianProfile.upsert({
      where: { userId },
      update: {},
      create: {
        userId,
        name: "Query",
        title: getGuardianTitle(1),
        avatarSeed: avatarSeedForUser(userId),
        level: 1,
        exp: 0,
        formStage: getGuardianFormStage(1),
        mood: "curious",
        personalityJson: toJsonValue(DEFAULT_GUARDIAN_PERSONALITY),
        preferencesJson: toJsonValue(DEFAULT_GUARDIAN_PREFERENCES),
      },
    })
    const baseExp = getGuardianEventExp(eventType)
    const cooldownMs = getGuardianEventCooldownMs(eventType)
    const latestSameEvent = await tx.guardianEvent.findFirst({
      where: { userId, eventType },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    })
    const withinCooldown = latestSameEvent
      ? Date.now() - latestSameEvent.createdAt.getTime() < cooldownMs
      : false
    const expDelta = withinCooldown ? 0 : baseExp
    const nextExp = profile.exp + expDelta
    const nextLevel = getGuardianLevelFromExp(nextExp)
    const nextMood = getGuardianMoodAfterEvent(eventType, profile.mood)
    const nextProfilePatch = {
      exp: nextExp,
      level: nextLevel,
      formStage: getGuardianFormStage(nextLevel),
      title: getGuardianTitle(nextLevel),
      mood: nextMood,
    }

    const event = await tx.guardianEvent.create({
      data: {
        userId,
        guardianProfileId: profile.id,
        eventType,
        source: input.source,
        pagePath: input.pagePath,
        expDelta,
        eventPayloadJson: toOptionalJsonValue(input.eventPayloadJson),
      },
    })
    const updatedProfile = await tx.guardianProfile.update({
      where: { id: profile.id },
      data: nextProfilePatch,
    })

    return {
      event: serializeEvent(event),
      profile: serializeProfile(updatedProfile),
      progress: getExpProgress(updatedProfile.exp),
      leveledUp: updatedProfile.level > profile.level,
      cooldownApplied: withinCooldown,
    }
  })
}
