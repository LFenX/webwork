import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getPresenceMap } from "@/lib/presence"
import { getSession } from "@/lib/session"

export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store" }

/** GET /api/friends — list the current user's friends */
export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "未登录" }, { status: 401, headers: NO_STORE })

  const uid = session.userId
  const friendships = await prisma.friendship.findMany({
    where: { OR: [{ userAId: uid }, { userBId: uid }] },
    include: {
      userA: { select: { id: true, email: true, publicSlug: true, displayName: true, bio: true, avatarText: true, avatarUrl: true } },
      userB: { select: { id: true, email: true, publicSlug: true, displayName: true, bio: true, avatarText: true, avatarUrl: true } },
    },
  })

  const rawFriends = friendships.map((f) => ({
    friendshipId: f.id,
    ...(f.userAId === uid ? f.userB : f.userA),
  }))
  const presence = await getPresenceMap(rawFriends.map((friend) => friend.id))
  const friends = rawFriends.map((friend) => ({
    ...friend,
    presenceStatus: presence.get(friend.id) ?? "offline",
  }))

  return NextResponse.json(friends, { headers: NO_STORE })
}
