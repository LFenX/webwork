export const GUARDIAN_SERVER_EVENT_TYPES = [
  "HOME_CLICKED",
  "SPRITE_CLICKED",
  "BUBBLE_OPENED",
  "ENTER_SQL_LAB",
  "SQL_LAB_DOCKED",
  "GUARDIAN_WOKE",
  "GUARDIAN_SLEPT",
  "USER_CHATTED_PLACEHOLDER",
  "QUERY_RUN_PLACEHOLDER",
  "QUERY_SUCCESS_PLACEHOLDER",
  "QUERY_ERROR_PLACEHOLDER",
] as const

export type GuardianServerEventType = typeof GUARDIAN_SERVER_EVENT_TYPES[number]

export const GUARDIAN_EVENT_EXP: Record<GuardianServerEventType, number> = {
  HOME_CLICKED: 1,
  SPRITE_CLICKED: 1,
  BUBBLE_OPENED: 1,
  ENTER_SQL_LAB: 1,
  SQL_LAB_DOCKED: 0,
  GUARDIAN_WOKE: 1,
  GUARDIAN_SLEPT: 0,
  USER_CHATTED_PLACEHOLDER: 2,
  QUERY_RUN_PLACEHOLDER: 2,
  QUERY_SUCCESS_PLACEHOLDER: 4,
  QUERY_ERROR_PLACEHOLDER: 1,
}

const GUARDIAN_EVENT_COOLDOWN_MS: Record<GuardianServerEventType, number> = {
  HOME_CLICKED: 30_000,
  SPRITE_CLICKED: 30_000,
  BUBBLE_OPENED: 30_000,
  ENTER_SQL_LAB: 5 * 60_000,
  SQL_LAB_DOCKED: 30_000,
  GUARDIAN_WOKE: 30_000,
  GUARDIAN_SLEPT: 30_000,
  USER_CHATTED_PLACEHOLDER: 30_000,
  QUERY_RUN_PLACEHOLDER: 30_000,
  QUERY_SUCCESS_PLACEHOLDER: 30_000,
  QUERY_ERROR_PLACEHOLDER: 30_000,
}

const EVENT_TYPE_SET = new Set<string>(GUARDIAN_SERVER_EVENT_TYPES)

export function isGuardianServerEventType(value: string): value is GuardianServerEventType {
  return EVENT_TYPE_SET.has(value)
}

export function getGuardianEventExp(eventType: GuardianServerEventType): number {
  return GUARDIAN_EVENT_EXP[eventType]
}

export function getGuardianEventCooldownMs(eventType: GuardianServerEventType): number {
  return GUARDIAN_EVENT_COOLDOWN_MS[eventType]
}

export function getGuardianMoodAfterEvent(eventType: GuardianServerEventType, currentMood: string) {
  if (eventType === "ENTER_SQL_LAB" || eventType === "SQL_LAB_DOCKED") return "focused"
  if (eventType === "GUARDIAN_SLEPT") return "sleepy"
  if (eventType === "QUERY_SUCCESS_PLACEHOLDER") return "proud"
  if (eventType === "QUERY_ERROR_PLACEHOLDER") return "confused"
  if (eventType === "HOME_CLICKED" || eventType === "GUARDIAN_WOKE") return "curious"
  return currentMood || "curious"
}
