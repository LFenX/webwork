import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { areFriends } from "@/lib/chat"
import { getChannelForUser, WORLD_CHANNEL_ID } from "@/lib/channel-chat"
import { getSession } from "@/lib/session"
import { channelInviteSchema } from "@/lib/validators"

export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store" }

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ channelId: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "未登录" }, { status: 401, headers: NO_STORE })

  const { channelId } = await params
  if (channelId === WORLD_CHANNEL_ID) {
    return NextResponse.json({ error: "世界频道不需要邀请成员" }, { status: 400, headers: NO_STORE })
  }

  const channel = await getChannelForUser(session.userId, channelId)
  if (!channel || channel.type !== "group") {
    return NextResponse.json({ error: "无权限邀请成员" }, { status: 403, headers: NO_STORE })
  }

  const body = await req.json().catch(() => null)
  const parsed = channelInviteSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().formErrors[0] ?? "请选择要邀请的好友" }, { status: 400, headers: NO_STORE })
  }

  const friendIds = [...new Set(parsed.data.memberIds.filter((id) => id !== session.userId))]
  const allowedIds: string[] = []
  for (const friendId of friendIds) {
    if (await areFriends(session.userId, friendId)) allowedIds.push(friendId)
  }

  if (allowedIds.length > 0) {
    await prisma.chatChannelMember.createMany({
      data: allowedIds.map((userId) => ({ channelId, userId, role: "member" })),
      skipDuplicates: true,
    })
  }

  const members = await prisma.chatChannelMember.findMany({
    where: { channelId },
    include: { user: { select: { id: true, email: true, displayName: true, avatarText: true, avatarUrl: true } } },
    orderBy: { joinedAt: "asc" },
  })

  return NextResponse.json({ members: members.map((member) => member.user) }, { headers: NO_STORE })
}
