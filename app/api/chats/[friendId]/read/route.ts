import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getFriendOrNull } from "@/lib/chat"
import { publishRealtime } from "@/lib/realtime-events"
import { getSession } from "@/lib/session"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const NO_STORE = { "Cache-Control": "no-store" }

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ friendId: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE })

  const { friendId } = await params
  const friend = await getFriendOrNull(session.userId, friendId)
  if (!friend) return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: NO_STORE })

  const body = await req.json().catch(() => ({})) as { messageIds?: unknown }
  const requestedIds = Array.isArray(body.messageIds)
    ? body.messageIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0)
    : []

  const unread = await prisma.chatMessage.findMany({
    where: {
      senderId: friendId,
      receiverId: session.userId,
      readAt: null,
      ...(requestedIds.length > 0 ? { id: { in: requestedIds } } : {}),
    },
    select: { id: true },
  })

  if (unread.length === 0) {
    return NextResponse.json({ ok: true, updated: 0 }, { headers: NO_STORE })
  }

  const readAt = new Date()
  await prisma.chatMessage.updateMany({
    where: { id: { in: unread.map((item) => item.id) } },
    data: { readAt },
  })

  publishRealtime(friendId, {
    type: "chat:read",
    data: {
      friendId: session.userId,
      readMessageIds: unread.map((item) => item.id),
      readAt: readAt.toISOString(),
    },
  })

  return NextResponse.json({ ok: true, updated: unread.length, readAt: readAt.toISOString() }, { headers: NO_STORE })
}
