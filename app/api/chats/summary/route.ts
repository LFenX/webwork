import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getSession } from "@/lib/session"

export const dynamic = "force-dynamic"

const NO_STORE = { "Cache-Control": "no-store" }

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE })

  const uid = session.userId
  const activeFriendId = req.nextUrl.searchParams.get("activeFriendId")?.trim() || null

  const friendships = await prisma.friendship.findMany({
    where: { OR: [{ userAId: uid }, { userBId: uid }] },
    select: { userAId: true, userBId: true },
  })
  const friendIds = friendships.map((friendship) => (friendship.userAId === uid ? friendship.userBId : friendship.userAId))
  if (friendIds.length === 0) return NextResponse.json({ items: [] }, { headers: NO_STORE })

  const [unreadGroups, latestMessages] = await Promise.all([
    prisma.chatMessage.groupBy({
      by: ["senderId"],
      where: { receiverId: uid, senderId: { in: friendIds }, readAt: null },
      _count: { _all: true },
    }),
    Promise.all(
      friendIds.map(async (friendId) => {
        const latest = await prisma.chatMessage.findFirst({
          where: {
            OR: [
              { senderId: uid, receiverId: friendId },
              { senderId: friendId, receiverId: uid },
            ],
          },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          include: { attachments: { select: { id: true, originalName: true } } },
        })
        return [friendId, latest] as const
      })
    ),
  ])

  const unread = new Map(unreadGroups.map((group) => [group.senderId, group._count._all]))
  const latestByFriend = new Map(latestMessages)

  return NextResponse.json({
    items: friendIds.map((friendId) => {
      const latest = latestByFriend.get(friendId)
      return {
        friendId,
        unreadCount: activeFriendId && activeFriendId === friendId ? 0 : unread.get(friendId) ?? 0,
        latest: latest
          ? {
              text: latest.text,
              stickerEmoji: latest.stickerEmoji,
              createdAt: latest.createdAt.toISOString(),
              hasAttachment: latest.attachments.length > 0,
              hasSticker: Boolean(latest.stickerId || latest.stickerEmoji),
            }
          : null,
      }
    }),
  }, { headers: NO_STORE })
}
