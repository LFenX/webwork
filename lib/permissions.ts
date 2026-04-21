import "server-only"
import { prisma } from "@/lib/db"

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
 *   "friend"  – friends, read-only public+friend-visible content
 *   "none"    – no access to private content
 */
export type AccessLevel = "self" | "friend" | "none"

export async function getAccessLevel(
  viewerId: string | null,
  ownerId: string
): Promise<AccessLevel> {
  if (!viewerId) return "none"
  if (viewerId === ownerId) return "self"
  const friends = await areFriends(viewerId, ownerId)
  return friends ? "friend" : "none"
}

/** Visibility levels that a viewer can see. */
export function visibleTo(level: AccessLevel): string[] {
  if (level === "self") return ["private", "friends", "public"]
  if (level === "friend") return ["friends", "public"]
  return ["public"]
}
