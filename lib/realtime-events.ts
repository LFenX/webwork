import "server-only"
import { prisma } from "@/lib/db"

export type RealtimeEventType =
  | "chat:message"
  | "chat:read"
  | "channel:message"
  | "friend-request:created"
  | "friend-request:accepted"
  | "announcement-feed:changed"
  | "presence:changed"
  | "admin:activity-changed"
  | "admin:permissions-changed"
  | "site:user-updated"

export type RealtimeEvent = {
  type: RealtimeEventType
  createdAt: string
  data: unknown
}

type Subscriber = {
  userId: string
  send: (event: RealtimeEvent) => void
}

const subscribers = new Set<Subscriber>()

async function listAllUserIds() {
  const users = await prisma.user.findMany({ select: { id: true } }).catch(() => [])
  return users.map((user) => user.id)
}

async function listAdminUserIds() {
  const users = await prisma.user.findMany({
    where: { role: { in: ["owner", "admin"] } },
    select: { id: true },
  }).catch(() => [])
  return users.map((user) => user.id)
}

export function subscribeRealtime(userId: string, send: Subscriber["send"]) {
  const subscriber = { userId, send }
  subscribers.add(subscriber)
  return () => {
    subscribers.delete(subscriber)
  }
}

export function publishRealtime(userIds: string | string[], event: Omit<RealtimeEvent, "createdAt"> & { createdAt?: string }) {
  const targets = new Set(Array.isArray(userIds) ? userIds : [userIds])
  const payload: RealtimeEvent = {
    ...event,
    createdAt: event.createdAt ?? new Date().toISOString(),
  }

  for (const subscriber of subscribers) {
    if (targets.has(subscriber.userId)) {
      subscriber.send(payload)
    }
  }
}

export async function publishAdminActivityChanged(data: Record<string, unknown> = {}) {
  const adminIds = await listAdminUserIds()
  if (adminIds.length === 0) return
  publishRealtime(adminIds, { type: "admin:activity-changed", data })
}

export async function publishPresenceChanged(data: {
  userId: string
  sessionId?: string | null
  action?: string
  detail?: string
}) {
  const userIds = await listAllUserIds()
  if (userIds.length > 0) {
    publishRealtime(userIds, { type: "presence:changed", data })
  }
  await publishAdminActivityChanged(data)
}

export async function publishAdminPermissionsChanged(userId: string) {
  const userIds = await listAllUserIds()
  if (userIds.length === 0) return
  publishRealtime(userIds, { type: "admin:permissions-changed", data: { userId } })
}

export async function publishUserPageChanged(userId: string, scope: string) {
  const userIds = await listAllUserIds()
  if (userIds.length === 0) return
  publishRealtime(userIds, { type: "site:user-updated", data: { userId, scope } })
}
