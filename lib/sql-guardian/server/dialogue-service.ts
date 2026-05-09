import "server-only"
import { Prisma } from "@/app/generated/prisma/client"
import { prisma } from "@/lib/db"
import { GuardianServiceError, getOrCreateGuardianProfile } from "@/lib/sql-guardian/server/profile-service"

export type GuardianDialogueRole = "user" | "assistant"

const CHAT_MIN_INTERVAL_MS = 5_000
const CHAT_MAX_PER_MINUTE = 10

function toIso(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}

function toOptionalJsonValue(value: unknown) {
  if (value === undefined) return undefined
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
}

export function serializeGuardianDialogue(dialogue: {
  id: string
  role: string
  content: string
  mood: string | null
  pagePath: string | null
  createdAt: Date
}) {
  return {
    id: dialogue.id,
    role: dialogue.role as GuardianDialogueRole,
    content: dialogue.content,
    mood: dialogue.mood,
    pagePath: dialogue.pagePath,
    createdAt: toIso(dialogue.createdAt),
  }
}

export async function listGuardianDialogues(
  userId: string,
  input: {
    limit: number
  }
) {
  const rows = await prisma.guardianDialogue.findMany({
    where: { userId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: input.limit,
  })

  return {
    items: rows.reverse().map(serializeGuardianDialogue),
  }
}

export async function listRecentGuardianDialogues(userId: string, limit = 6) {
  const rows = await prisma.guardianDialogue.findMany({
    where: { userId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit,
  })

  return rows.reverse().map(serializeGuardianDialogue)
}

export async function assertGuardianChatRateLimit(userId: string, now = Date.now()) {
  const latestUserMessage = await prisma.guardianDialogue.findFirst({
    where: { userId, role: "user" },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  })

  if (latestUserMessage && now - latestUserMessage.createdAt.getTime() < CHAT_MIN_INTERVAL_MS) {
    throw new GuardianServiceError("RATE_LIMITED", "Guardian chat is cooling down", 429)
  }

  const recentCount = await prisma.guardianDialogue.count({
    where: {
      userId,
      role: "user",
      createdAt: {
        gte: new Date(now - 60_000),
      },
    },
  })

  if (recentCount >= CHAT_MAX_PER_MINUTE) {
    throw new GuardianServiceError("RATE_LIMITED", "Guardian chat is rate limited", 429)
  }
}

export async function saveGuardianDialoguePair(
  userId: string,
  input: {
    guardianProfileId: string
    userContent: string
    assistantContent: string
    mood?: string | null
    pagePath?: string
    metadataJson?: unknown
  }
) {
  return prisma.$transaction(async (tx) => {
    const userDialogue = await tx.guardianDialogue.create({
      data: {
        userId,
        guardianProfileId: input.guardianProfileId,
        role: "user",
        content: input.userContent,
        mood: input.mood ?? null,
        pagePath: input.pagePath,
        metadataJson: toOptionalJsonValue(input.metadataJson),
      },
    })

    const assistantDialogue = await tx.guardianDialogue.create({
      data: {
        userId,
        guardianProfileId: input.guardianProfileId,
        role: "assistant",
        content: input.assistantContent,
        mood: input.mood ?? null,
        pagePath: input.pagePath,
        metadataJson: toOptionalJsonValue(input.metadataJson),
      },
    })

    return {
      user: serializeGuardianDialogue(userDialogue),
      assistant: serializeGuardianDialogue(assistantDialogue),
    }
  })
}

export async function getGuardianProfileForDialogue(userId: string) {
  return getOrCreateGuardianProfile(userId)
}
