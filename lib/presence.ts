import "server-only"
import { prisma } from "@/lib/db"
import { AWAY_AFTER_MS, EXPIRE_AFTER_MS } from "@/lib/session"

export type PresenceStatus = "online" | "away" | "offline"

export function presenceFromLastSeen(lastSeenAt?: Date | null, active = false): PresenceStatus {
  if (!active || !lastSeenAt) return "offline"
  const age = Date.now() - lastSeenAt.getTime()
  if (age >= EXPIRE_AFTER_MS) return "offline"
  if (age >= AWAY_AFTER_MS) return "away"
  return "online"
}

export async function getPresenceMap(userIds: string[]) {
  const ids = Array.from(new Set(userIds)).filter(Boolean)
  if (ids.length === 0) return new Map<string, PresenceStatus>()

  const sessions = await prisma.userSession.findMany({
    where: { userId: { in: ids }, status: "active" },
    select: { userId: true, lastSeenAt: true },
    orderBy: { lastSeenAt: "desc" },
  })

  const map = new Map<string, PresenceStatus>()
  for (const id of ids) map.set(id, "offline")
  for (const session of sessions) {
    if (map.get(session.userId) === "online") continue
    const status = presenceFromLastSeen(session.lastSeenAt, true)
    if (status === "online" || map.get(session.userId) === "offline") {
      map.set(session.userId, status)
    }
  }
  return map
}
