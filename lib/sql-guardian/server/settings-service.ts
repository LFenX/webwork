import "server-only"

import { Prisma } from "@/app/generated/prisma/client"
import { prisma } from "@/lib/db"
import {
  DEFAULT_GUARDIAN_PREFERENCES,
  getOrCreateGuardianProfile,
  serializeGuardianProfileResponse,
} from "@/lib/sql-guardian/server/profile-service"
import { normalizeJsonInput, type GuardianSettingsInput } from "@/lib/sql-guardian/server/validation"
import type { GuardianSettings } from "@/lib/sql-guardian/types"

export const DEFAULT_GUARDIAN_SETTINGS = {
  guardianEnabled: true,
  animationsEnabled: true,
  autoPatrolEnabled: true,
  autoBubbleEnabled: true,
  autoBubbleInSqlLab: false,
  guardianEventTrackingEnabled: true,
  guardianChatHistoryEnabled: true,
  guardianMemoryEnabled: true,
  sqlAssistantPersonaEnabled: true,
  soulwingToGuardianMemoryBridgeEnabled: false,
  guardianToSoulWingMemoryBridgeEnabled: false,
} as const satisfies GuardianSettings

const SETTING_KEYS = Object.keys(DEFAULT_GUARDIAN_SETTINGS) as Array<keyof GuardianSettings>

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value))
}

function toJsonValue(value: unknown) {
  return (normalizeJsonInput(value) ?? Prisma.JsonNull) as Prisma.InputJsonValue
}

export function normalizeGuardianSettings(preferencesJson: unknown): GuardianSettings {
  const source = isRecord(preferencesJson) ? preferencesJson : {}
  const settings: GuardianSettings = { ...DEFAULT_GUARDIAN_SETTINGS }

  for (const key of SETTING_KEYS) {
    if (typeof source[key] === "boolean") {
      settings[key] = source[key]
    }
  }

  return settings
}

export function isGuardianEnabled(preferencesJson: unknown) {
  return normalizeGuardianSettings(preferencesJson).guardianEnabled
}

export function isGuardianEventTrackingEnabled(preferencesJson: unknown) {
  const settings = normalizeGuardianSettings(preferencesJson)
  return settings.guardianEnabled && settings.guardianEventTrackingEnabled
}

export function isGuardianChatHistoryEnabled(preferencesJson: unknown) {
  return normalizeGuardianSettings(preferencesJson).guardianChatHistoryEnabled
}

function pickSettings(input: GuardianSettingsInput) {
  const patch: Partial<GuardianSettings> = {}
  for (const key of SETTING_KEYS) {
    if (typeof input[key] === "boolean") {
      patch[key] = input[key]
    }
  }
  return patch
}

export async function getGuardianSettings(userId: string) {
  const profile = await getOrCreateGuardianProfile(userId)
  return {
    settings: normalizeGuardianSettings(profile.preferencesJson),
    ...serializeGuardianProfileResponse(profile),
  }
}

export async function updateGuardianSettings(userId: string, input: GuardianSettingsInput) {
  const current = await getOrCreateGuardianProfile(userId)
  const existingPreferences = isRecord(current.preferencesJson)
    ? current.preferencesJson
    : DEFAULT_GUARDIAN_PREFERENCES
  const patch = pickSettings(input)

  const profile = await prisma.guardianProfile.update({
    where: { userId },
    data: {
      preferencesJson: toJsonValue({
        ...existingPreferences,
        ...patch,
      }),
    },
  })

  return {
    settings: normalizeGuardianSettings(profile.preferencesJson),
    ...serializeGuardianProfileResponse(profile),
  }
}
