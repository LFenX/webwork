import type {
  GuardianClientEventType,
  GuardianEventResponse,
  GuardianMood,
  GuardianPreferences,
  GuardianProfileResponse,
} from "@/lib/sql-guardian/types"

const PROFILE_ENDPOINT = "/api/sql-guardian/profile"
const EVENTS_ENDPOINT = "/api/sql-guardian/events"

async function readJson<T>(response: Response): Promise<T | null> {
  if (response.status === 401) return null
  if (!response.ok) return null

  try {
    return (await response.json()) as T
  } catch {
    return null
  }
}

export async function fetchGuardianProfile(options?: {
  signal?: AbortSignal
}): Promise<GuardianProfileResponse | null> {
  try {
    const response = await fetch(PROFILE_ENDPOINT, {
      cache: "no-store",
      credentials: "same-origin",
      signal: options?.signal,
    })

    return readJson<GuardianProfileResponse>(response)
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return null
    return null
  }
}

export async function postGuardianEvent(input: {
  eventType: GuardianClientEventType
  source?: string
  pagePath?: string
  eventPayloadJson?: Record<string, unknown>
}): Promise<GuardianEventResponse | null> {
  try {
    const response = await fetch(EVENTS_ENDPOINT, {
      method: "POST",
      cache: "no-store",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })

    return readJson<GuardianEventResponse>(response)
  } catch {
    return null
  }
}

export async function patchGuardianProfile(input: {
  name?: string
  mood?: GuardianMood
  preferencesJson?: Partial<GuardianPreferences>
}): Promise<GuardianProfileResponse | null> {
  try {
    const response = await fetch(PROFILE_ENDPOINT, {
      method: "PATCH",
      cache: "no-store",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })

    return readJson<GuardianProfileResponse>(response)
  } catch {
    return null
  }
}
