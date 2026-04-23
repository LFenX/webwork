export type RealtimeEventType =
  | "chat:message"
  | "channel:message"
  | "friend-request:created"
  | "friend-request:accepted"
  | "announcement-feed:changed"

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
