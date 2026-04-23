import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getSession } from "@/lib/session"

export const dynamic = "force-dynamic"

const NO_STORE = { "Cache-Control": "no-store" }

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "未登录" }, { status: 401, headers: NO_STORE })

  const uid = session.userId
  const friendships = await prisma.friendship.findMany({
    where: { OR: [{ userAId: uid }, { userBId: uid }] },
    select: { userAId: true, userBId: true },
  })
  const friendIds = friendships.map((friendship) => friendship.userAId === uid ? friendship.userBId : friendship.userAId)
  if (friendIds.length === 0) return NextResponse.json({ items: [] }, { headers: NO_STORE })

  const [latestMessages, unreadGroups] = await Promise.all([
    prisma.chatMessage.findMany({
      where: { OR: [{ senderId: uid }, { receiverId: uid }] },
      orderBy: { createdAt: "desc" },
      take: 300,
      include: { attachments: { select: { id: true, originalName: true } } },
    }),
    prisma.chatMessage.groupBy({
      by: ["senderId"],
      where: { receiverId: uid, senderId: { in: friendIds }, readAt: null },
      _count: { _all: true },
    }),
  ])

  const unread = new Map(unreadGroups.map((group) => [group.senderId, group._count._all]))
  const latest = new Map<string, { text: string; createdAt: string; hasAttachment: boolean }>()
  for (const message of latestMessages) {
    const friendId = message.senderId === uid ? message.receiverId : message.senderId
    if (!friendIds.includes(friendId) || latest.has(friendId)) continue
    latest.set(friendId, {
      text: message.text,
      createdAt: message.createdAt.toISOString(),
      hasAttachment: message.attachments.length > 0,
    })
  }

  return NextResponse.json({
    items: friendIds.map((friendId) => ({
      friendId,
      unreadCount: unread.get(friendId) ?? 0,
      latest: latest.get(friendId) ?? null,
    })),
  }, { headers: NO_STORE })
}
