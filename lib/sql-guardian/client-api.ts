import type {
  GuardianChatResponse,
  GuardianClientEventType,
  GuardianDialogueListResponse,
  GuardianEventResponse,
  GuardianMemoryListResponse,
  GuardianMemoryMutationResponse,
  GuardianMemoryStatus,
  GuardianMemoryType,
  GuardianMood,
  GuardianPreferences,
  GuardianProfileResponse,
} from "@/lib/sql-guardian/types"

const PROFILE_ENDPOINT = "/api/sql-guardian/profile"
const EVENTS_ENDPOINT = "/api/sql-guardian/events"
const CHAT_ENDPOINT = "/api/sql-guardian/chat"
const DIALOGUES_ENDPOINT = "/api/sql-guardian/dialogues"
const MEMORIES_ENDPOINT = "/api/sql-guardian/memories"

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

export async function postGuardianChat(input: {
  message: string
  pagePath?: string
}): Promise<GuardianChatResponse | null> {
  try {
    const response = await fetch(CHAT_ENDPOINT, {
      method: "POST",
      cache: "no-store",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })

    if (response.status === 401) return null
    const payload = await response.json().catch(() => null)
    if (response.status === 429 && payload) return payload as GuardianChatResponse
    if (!response.ok || !payload) return null
    return payload as GuardianChatResponse
  } catch {
    return null
  }
}

export async function fetchGuardianDialogues(options?: {
  limit?: number
  signal?: AbortSignal
}): Promise<GuardianDialogueListResponse | null> {
  const params = new URLSearchParams()
  if (options?.limit) params.set("limit", String(options.limit))
  const endpoint = params.size ? `${DIALOGUES_ENDPOINT}?${params.toString()}` : DIALOGUES_ENDPOINT

  try {
    const response = await fetch(endpoint, {
      cache: "no-store",
      credentials: "same-origin",
      signal: options?.signal,
    })

    return readJson<GuardianDialogueListResponse>(response)
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return null
    return null
  }
}

export async function fetchGuardianMemories(options?: {
  status?: GuardianMemoryStatus[]
  type?: GuardianMemoryType
  limit?: number
  signal?: AbortSignal
}): Promise<GuardianMemoryListResponse | null> {
  const params = new URLSearchParams()
  if (options?.status?.length) params.set("status", options.status.join(","))
  if (options?.type) params.set("type", options.type)
  if (options?.limit) params.set("limit", String(options.limit))
  const endpoint = params.size ? `${MEMORIES_ENDPOINT}?${params.toString()}` : MEMORIES_ENDPOINT

  try {
    const response = await fetch(endpoint, {
      cache: "no-store",
      credentials: "same-origin",
      signal: options?.signal,
    })

    return readJson<GuardianMemoryListResponse>(response)
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return null
    return null
  }
}

export async function createGuardianMemory(input: {
  type: GuardianMemoryType
  content: string
  importance?: number
  summary?: string
}): Promise<GuardianMemoryMutationResponse | null> {
  try {
    const response = await fetch(MEMORIES_ENDPOINT, {
      method: "POST",
      cache: "no-store",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })

    return readJson<GuardianMemoryMutationResponse>(response)
  } catch {
    return null
  }
}

export async function updateGuardianMemory(id: string, input: {
  type?: GuardianMemoryType
  status?: GuardianMemoryStatus
  content?: string
  importance?: number
  summary?: string | null
}): Promise<GuardianMemoryMutationResponse | null> {
  try {
    const response = await fetch(`${MEMORIES_ENDPOINT}/${encodeURIComponent(id)}`, {
      method: "PATCH",
      cache: "no-store",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })

    return readJson<GuardianMemoryMutationResponse>(response)
  } catch {
    return null
  }
}

export async function deleteGuardianMemory(id: string): Promise<{ deleted: true; id: string } | null> {
  try {
    const response = await fetch(`${MEMORIES_ENDPOINT}/${encodeURIComponent(id)}`, {
      method: "DELETE",
      cache: "no-store",
      credentials: "same-origin",
    })

    return readJson<{ deleted: true; id: string }>(response)
  } catch {
    return null
  }
}
