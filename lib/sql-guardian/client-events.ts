import type { GuardianCommandReason, GuardianEventType } from "@/lib/sql-guardian/types"

export const GUARDIAN_WAKE_EVENT = "sql-guardian:wake"
export const GUARDIAN_COMMAND_EVENT = "sql-guardian:command"

export type GuardianWakeDetail = {
  reason?: GuardianCommandReason
}

export type GuardianCommandDetail = {
  command: GuardianEventType
  payload?: unknown
}

export function wakeGuardian(reason: GuardianCommandReason = "manual") {
  if (typeof window === "undefined") return

  window.dispatchEvent(
    new CustomEvent<GuardianWakeDetail>(GUARDIAN_WAKE_EVENT, {
      detail: { reason },
    })
  )
}

export function commandGuardian(command: GuardianEventType, payload?: unknown) {
  if (typeof window === "undefined") return

  window.dispatchEvent(
    new CustomEvent<GuardianCommandDetail>(GUARDIAN_COMMAND_EVENT, {
      detail: { command, payload },
    })
  )
}

export function getGuardianWakeDetail(event: Event): GuardianWakeDetail {
  return event instanceof CustomEvent && typeof event.detail === "object" && event.detail
    ? (event.detail as GuardianWakeDetail)
    : {}
}

export function getGuardianCommandDetail(event: Event): GuardianCommandDetail | null {
  return event instanceof CustomEvent && typeof event.detail === "object" && event.detail
    ? (event.detail as GuardianCommandDetail)
    : null
}
