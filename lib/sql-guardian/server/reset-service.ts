import "server-only"

import crypto from "node:crypto"
import { Prisma } from "@/app/generated/prisma/client"
import { prisma } from "@/lib/db"
import {
  DEFAULT_GUARDIAN_PERSONALITY,
  GuardianServiceError,
  getOrCreateGuardianProfile,
  serializeGuardianProfileResponse,
} from "@/lib/sql-guardian/server/profile-service"
import {
  getGuardianFormStage,
  getGuardianTitle,
} from "@/lib/sql-guardian/server/progression"
import { normalizeGuardianSettings } from "@/lib/sql-guardian/server/settings-service"
import { normalizeJsonInput, type GuardianResetInput } from "@/lib/sql-guardian/server/validation"

type ResetCounts = {
  dialoguesDeleted: number
  eventsDeleted: number
  memoriesDeleted: number
  bridgesRevoked: number
  profileReset: boolean
}

function toJsonValue(value: unknown) {
  return (normalizeJsonInput(value) ?? Prisma.JsonNull) as Prisma.InputJsonValue
}

function avatarSeedForReset(userId: string) {
  return crypto
    .createHash("sha256")
    .update(`${userId}:guardian-reset:${Date.now()}:${crypto.randomUUID()}`)
    .digest("hex")
    .slice(0, 24)
}

function emptyCounts(): ResetCounts {
  return {
    dialoguesDeleted: 0,
    eventsDeleted: 0,
    memoriesDeleted: 0,
    bridgesRevoked: 0,
    profileReset: false,
  }
}

function shouldResetProfile(scope: GuardianResetInput["scope"]) {
  return scope === "profile" || scope === "all"
}

function shouldResetGrowth(scope: GuardianResetInput["scope"]) {
  return scope === "events" || scope === "all" || scope === "profile"
}

export async function resetGuardianData(userId: string, input: GuardianResetInput) {
  if (input.confirmText !== "RESET SQL GUARDIAN") {
    throw new GuardianServiceError("INVALID_RESET_CONFIRMATION", "Reset confirmation is invalid", 400)
  }

  const currentProfile = await getOrCreateGuardianProfile(userId)
  const result = await prisma.$transaction(async (tx) => {
    const counts = emptyCounts()

    if (input.scope === "dialogues" || input.scope === "all") {
      counts.dialoguesDeleted = (await tx.guardianDialogue.deleteMany({ where: { userId } })).count
    }

    if (input.scope === "events" || input.scope === "all") {
      counts.eventsDeleted = (await tx.guardianEvent.deleteMany({ where: { userId } })).count
    }

    if (input.scope === "memories" || input.scope === "all") {
      counts.memoriesDeleted = (await tx.guardianMemory.deleteMany({ where: { userId } })).count
    }

    if (input.scope === "bridge" || input.scope === "all") {
      counts.bridgesRevoked = (await tx.guardianMemoryBridge.updateMany({
        where: { userId, status: "active" },
        data: {
          status: "revoked",
          revokedAt: new Date(),
        },
      })).count
    }

    const level = 1
    const profilePatch = shouldResetGrowth(input.scope)
      ? {
          exp: 0,
          level,
          title: getGuardianTitle(level),
          formStage: getGuardianFormStage(level),
          mood: "curious",
        }
      : {}

    const profile = await tx.guardianProfile.update({
      where: { id: currentProfile.id },
      data: {
        ...profilePatch,
        ...(shouldResetProfile(input.scope)
          ? {
              name: "Query",
              avatarSeed: avatarSeedForReset(userId),
              personalityJson: toJsonValue(DEFAULT_GUARDIAN_PERSONALITY),
            }
          : {}),
      },
    })

    counts.profileReset = shouldResetProfile(input.scope) || shouldResetGrowth(input.scope)

    return {
      counts,
      profile,
    }
  })

  return {
    scope: input.scope,
    counts: result.counts,
    settings: normalizeGuardianSettings(result.profile.preferencesJson),
    ...serializeGuardianProfileResponse(result.profile),
  }
}
