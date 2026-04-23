"use client"

export type OutboxConversationType = "direct" | "channel"

export type ChatOutboxItem = {
  id: string
  clientMutationId: string
  userId: string
  conversationType: OutboxConversationType
  conversationId: string
  text: string
  sendOriginal?: boolean
  sticker?: { type: "emoji"; emoji: string } | { type: "asset"; id: string; url: string; name: string; isAnimated: boolean } | null
  files: File[]
  createdAt: number
  lastError?: string
}

const DB_NAME = "my-space-chat-outbox"
const STORE_NAME = "items"
export const CHAT_OUTBOX_TTL_MS = 24 * 60 * 60 * 1000
export const CHAT_OUTBOX_MAX_BYTES = 80 * 1024 * 1024

let dbPromise: Promise<IDBDatabase> | null = null

function openDb() {
  if (typeof indexedDB === "undefined") return Promise.reject(new Error("IndexedDB unavailable"))
  if (dbPromise) return dbPromise

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" })
        store.createIndex("byUser", "userId")
        store.createIndex("byConversation", ["userId", "conversationType", "conversationId"])
        store.createIndex("byCreatedAt", "createdAt")
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error("Failed to open outbox"))
  })

  return dbPromise
}

function requestToPromise<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"))
  })
}

function fileBytes(files: File[]) {
  return files.reduce((sum, file) => sum + file.size, 0)
}

async function allItems(db: IDBDatabase) {
  const tx = db.transaction(STORE_NAME, "readonly")
  return requestToPromise<ChatOutboxItem[]>(tx.objectStore(STORE_NAME).getAll())
}

export async function pruneChatOutbox(userId?: string) {
  const db = await openDb().catch(() => null)
  if (!db) return
  const items = await allItems(db).catch(() => [])
  const now = Date.now()
  const expired = items.filter((item) => now - item.createdAt > CHAT_OUTBOX_TTL_MS || (userId && item.userId === userId))
  if (expired.length === 0) return
  const tx = db.transaction(STORE_NAME, "readwrite")
  expired.forEach((item) => tx.objectStore(STORE_NAME).delete(item.id))
}

export async function saveChatOutboxItem(item: ChatOutboxItem) {
  const db = await openDb()
  await pruneChatOutbox()
  const items = await allItems(db).catch(() => [])
  const existingBytes = items.reduce((sum, current) => sum + fileBytes(current.files), 0)
  if (existingBytes + fileBytes(item.files) > CHAT_OUTBOX_MAX_BYTES) {
    throw new Error("本地待发送附件缓存已满，请先清理失败消息后再重试")
  }
  const tx = db.transaction(STORE_NAME, "readwrite")
  await requestToPromise(tx.objectStore(STORE_NAME).put(item))
}

export async function deleteChatOutboxItem(id: string) {
  const db = await openDb().catch(() => null)
  if (!db) return
  const tx = db.transaction(STORE_NAME, "readwrite")
  await requestToPromise(tx.objectStore(STORE_NAME).delete(id))
}

export async function listChatOutboxItems(userId: string, conversationType: OutboxConversationType, conversationId: string) {
  const db = await openDb().catch(() => null)
  if (!db) return []
  await pruneChatOutbox()
  const tx = db.transaction(STORE_NAME, "readonly")
  const index = tx.objectStore(STORE_NAME).index("byConversation")
  const items = await requestToPromise<ChatOutboxItem[]>(index.getAll([userId, conversationType, conversationId]))
  return items.sort((a, b) => a.createdAt - b.createdAt)
}

export async function clearChatOutboxForUser(userId: string) {
  await pruneChatOutbox(userId)
}
