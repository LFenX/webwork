import "server-only"
import { prisma } from "@/lib/db"
import { normalizeVisibility, type Visibility } from "@/lib/visibility"

/** Check if viewerId and ownerId are friends (friendship is bidirectional). */
export async function areFriends(viewerId: string, ownerId: string): Promise<boolean> {
  if (viewerId === ownerId) return false
  const [a, b] = viewerId < ownerId ? [viewerId, ownerId] : [ownerId, viewerId]
  const f = await prisma.friendship.findUnique({ where: { userAId_userBId: { userAId: a, userBId: b } } })
  return f !== null
}

/**
 * Returns the access level of viewerId when looking at ownerId's data.
 *   "self"    – same user, full access
 *   "friend"  - friends, read-only public+friend-visible content
 *   "public"  - visitors and non-friends, read-only public content
 */
export type AccessLevel = "self" | "friend" | "public"
export type ModuleKey = "home" | "resume" | "blog" | "daily" | "reflections" | "notes" | "jobs" | "interviews"

export async function getAccessLevel(
  viewerId: string | null,
  ownerId: string
): Promise<AccessLevel> {
  if (!viewerId) return "public"
  if (viewerId === ownerId) return "self"
  const friends = await areFriends(viewerId, ownerId)
  return friends ? "friend" : "public"
}

/** Visibility levels that a viewer can see. */
export function visibleTo(level: AccessLevel): Visibility[] {
  if (level === "self") return ["private", "friends", "public"]
  if (level === "friend") return ["friends", "public"]
  return ["public"]
}

export async function getModuleVisibility(userId: string, module: ModuleKey): Promise<Visibility> {
  const setting = await prisma.moduleVisibility.findUnique({
    where: { userId_module: { userId, module } },
    select: { visibility: true },
  })
  return normalizeVisibility(setting?.visibility)
}

export async function canViewModule(
  ownerId: string,
  module: ModuleKey,
  level: AccessLevel
): Promise<boolean> {
  if (level === "self") return true
  const visibility = await getModuleVisibility(ownerId, module)
  if (level === "friend") return visibility === "friends" || visibility === "public"
  return visibility === "public"
}

export async function recordVisit({
  ownerId,
  visitorId,
  module,
  path,
  postId,
}: {
  ownerId: string
  visitorId: string | null
  module: ModuleKey
  path: string
  postId?: string
}) {
  if (visitorId === ownerId) return
  await prisma.visitLog.create({
    data: {
      ownerId,
      visitorId,
      module,
      path,
      postId,
    },
  }).catch(() => null)
}
