export const GUARDIAN_WAKE_EVENT = "sql-guardian:wake"

export type GuardianWakeDetail = {
  reason?: string
}

export function wakeGuardian(reason?: string) {
  if (typeof window === "undefined") return

  window.dispatchEvent(
    new CustomEvent<GuardianWakeDetail>(GUARDIAN_WAKE_EVENT, {
      detail: { reason },
    })
  )
}

export function getGuardianWakeDetail(event: Event): GuardianWakeDetail {
  return event instanceof CustomEvent && typeof event.detail === "object" && event.detail
    ? (event.detail as GuardianWakeDetail)
    : {}
}
