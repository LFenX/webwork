import "server-only"
import { prisma } from "@/lib/db"
import { AWAY_AFTER_MS, EXPIRE_AFTER_MS, FOREGROUND_OFFLINE_AFTER_MS } from "@/lib/session"

export type PresenceStatus = "online" | "away" | "offline"

export function presenceFromSession(
  session?: { lastSeenAt?: Date | null; lastActiveAt?: Date | null; lastForegroundAt?: Date | null } | null,
  active = false
): PresenceStatus {
  if (!active || !session?.lastSeenAt || !session.lastActiveAt || !session.lastForegroundAt) return "offline"
  const now = Date.now()
  if (now - session.lastSeenAt.getTime() >= EXPIRE_AFTER_MS) return "offline"
  if (now - session.lastForegroundAt.getTime() >= FOREGROUND_OFFLINE_AFTER_MS) return "offline"
  if (now - session.lastActiveAt.getTime() >= AWAY_AFTER_MS) return "away"
  return "online"
}

export async function getPresenceMap(userIds: string[]) {
  const ids = Array.from(new Set(userIds)).filter(Boolean)
  if (ids.length === 0) return new Map<string, PresenceStatus>()

  const sessions = await prisma.userSession.findMany({
    where: { userId: { in: ids }, status: "active" },
    select: {
      userId: true,
      sessionId: true,
      lastSeenAt: true,
      lastActiveAt: true,
      lastForegroundAt: true,
      lastOfflineActivityAt: true,
      ipAddress: true,
      geoLocation: true,
      deviceInfo: true,
    },
    orderBy: { lastForegroundAt: "desc" },
  })

  const now = new Date()
  const staleSessions = sessions.filter((session) =>
    now.getTime() - session.lastForegroundAt.getTime() >= FOREGROUND_OFFLINE_AFTER_MS &&
    (!session.lastOfflineActivityAt || session.lastOfflineActivityAt.getTime() < session.lastForegroundAt.getTime())
  )
  if (staleSessions.length > 0) {
    await prisma.$transaction([
      ...staleSessions.map((session) =>
        prisma.userSession.update({
          where: { sessionId: session.sessionId },
          data: { lastOfflineActivityAt: now },
        })
      ),
      prisma.userActivity.createMany({
        data: staleSessions.map((session) => ({
          userId: session.userId,
          sessionId: session.sessionId,
          action: "logout",
          detail: "离开 Web App 或关闭页面",
          ipAddress: session.ipAddress,
          geoLocation: session.geoLocation,
          deviceInfo: session.deviceInfo,
          createdAt: now,
        })),
      }),
    ]).catch(() => null)
  }

  const map = new Map<string, PresenceStatus>()
  for (const id of ids) map.set(id, "offline")
  for (const session of sessions) {
    if (map.get(session.userId) === "online") continue
    const status = presenceFromSession(session, true)
    if (status === "online" || map.get(session.userId) === "offline") {
      map.set(session.userId, status)
    }
  }
  return map
}
