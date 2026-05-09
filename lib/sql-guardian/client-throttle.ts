import type { GuardianClientEventType } from "@/lib/sql-guardian/types"

const DEFAULT_COOLDOWN_MS = 30_000
const EVENT_COOLDOWN_MS: Record<GuardianClientEventType, number> = {
  HOME_CLICKED: DEFAULT_COOLDOWN_MS,
  SPRITE_CLICKED: DEFAULT_COOLDOWN_MS,
  BUBBLE_OPENED: DEFAULT_COOLDOWN_MS,
  GUARDIAN_WOKE: DEFAULT_COOLDOWN_MS,
  ENTER_SQL_LAB: 5 * 60_000,
}

const lastSentAt = new Map<GuardianClientEventType, number>()

export function canSendGuardianClientEvent(eventType: GuardianClientEventType, now = Date.now()) {
  const last = lastSentAt.get(eventType) ?? 0
  return now - last >= EVENT_COOLDOWN_MS[eventType]
}

export function markGuardianClientEventSent(eventType: GuardianClientEventType, now = Date.now()) {
  lastSentAt.set(eventType, now)
}

export function resetGuardianClientEventThrottle() {
  lastSentAt.clear()
}
