"use client"

const APP_PREFIX = "my-space"

type StoredEnvelope<T> = {
  version: number
  userId: string
  savedAt: number
  value: T
}

type StorageKind = "local" | "session"

function getStore(kind: StorageKind): Storage | null {
  if (typeof window === "undefined") return null
  try {
    return kind === "local" ? window.localStorage : window.sessionStorage
  } catch {
    return null
  }
}

export function userStorageKey(userId: string, namespace: string, id: string, version = 1) {
  return `${APP_PREFIX}:${namespace}:${userId}:${id}:v${version}`
}

export function readUserStorage<T>({
  kind,
  key,
  userId,
  ttlMs,
  version = 1,
}: {
  kind: StorageKind
  key: string
  userId: string
  ttlMs: number
  version?: number
}): T | null {
  const store = getStore(kind)
  if (!store) return null

  const raw = store.getItem(key)
  if (!raw) return null

  try {
    const envelope = JSON.parse(raw) as Partial<StoredEnvelope<T>>
    const expired = typeof envelope.savedAt !== "number" || Date.now() - envelope.savedAt > ttlMs
    if (envelope.version !== version || envelope.userId !== userId || expired || !("value" in envelope)) {
      store.removeItem(key)
      return null
    }
    return envelope.value as T
  } catch {
    store.removeItem(key)
    return null
  }
}

export function writeUserStorage<T>({
  kind,
  key,
  userId,
  value,
  version = 1,
}: {
  kind: StorageKind
  key: string
  userId: string
  value: T
  version?: number
}) {
  const store = getStore(kind)
  if (!store) return

  const envelope: StoredEnvelope<T> = {
    version,
    userId,
    savedAt: Date.now(),
    value,
  }

  try {
    store.setItem(key, JSON.stringify(envelope))
  } catch {
    // Best effort only: storage may be unavailable or full.
  }
}

export function removeUserStorage(kind: StorageKind, key: string) {
  getStore(kind)?.removeItem(key)
}

export function clearUserLocalState(userId: string) {
  if (typeof window === "undefined") return
  const prefix = `${APP_PREFIX}:`
  for (const store of [getStore("local"), getStore("session")]) {
    if (!store) continue
    const keys: string[] = []
    for (let index = 0; index < store.length; index += 1) {
      const key = store.key(index)
      if (key?.startsWith(prefix) && key.includes(`:${userId}:`)) keys.push(key)
    }
    keys.forEach((key) => store.removeItem(key))
  }

  try {
    window.dispatchEvent(new CustomEvent("app:local-state-cleared", { detail: { userId } }))
    const channel = new BroadcastChannel("app-local-state")
    channel.postMessage({ type: "cleared", userId })
    channel.close()
  } catch {
    // BroadcastChannel is optional.
  }
}
