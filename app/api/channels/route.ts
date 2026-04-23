import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { areFriends } from "@/lib/chat"
import { ensureWorldChannel } from "@/lib/channel-chat"
import { getSession } from "@/lib/session"
import { channelCreateSchema } from "@/lib/validators"

export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store" }

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "未登录" }, { status: 401, headers: NO_STORE })

  const world = await ensureWorldChannel()
  const groups = await prisma.chatChannel.findMany({
    where: {
      type: "group",
      members: { some: { userId: session.userId } },
    },
    orderBy: { updatedAt: "desc" },
    include: {
      members: {
        include: { user: { select: { id: true, email: true, displayName: true, avatarText: true, avatarUrl: true } } },
        orderBy: { joinedAt: "asc" },
      },
    },
  })

  return NextResponse.json({
    currentUserId: session.userId,
    items: [
      { id: world.id, type: world.type, name: world.name, members: [] },
      ...groups.map((channel) => ({
        id: channel.id,
        type: channel.type,
        name: channel.name,
        members: channel.members.map((member) => member.user),
      })),
    ],
  }, { headers: NO_STORE })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "未登录" }, { status: 401, headers: NO_STORE })

  const body = await req.json().catch(() => null)
  const parsed = channelCreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().formErrors[0] ?? "群组名称不能为空" }, { status: 400, headers: NO_STORE })
  }

  const friendIds = [...new Set(parsed.data.memberIds.filter((id) => id !== session.userId))]
  const allowedIds: string[] = []
  for (const friendId of friendIds) {
    if (await areFriends(session.userId, friendId)) allowedIds.push(friendId)
  }

  const channel = await prisma.chatChannel.create({
    data: {
      name: parsed.data.name,
      type: "group",
      createdById: session.userId,
      members: {
        create: [
          { userId: session.userId, role: "owner" },
          ...allowedIds.map((userId) => ({ userId, role: "member" })),
        ],
      },
    },
    include: {
      members: {
        include: { user: { select: { id: true, email: true, displayName: true, avatarText: true, avatarUrl: true } } },
        orderBy: { joinedAt: "asc" },
      },
    },
  })

  return NextResponse.json({
    id: channel.id,
    type: channel.type,
    name: channel.name,
    members: channel.members.map((member) => member.user),
  }, { status: 201, headers: NO_STORE })
}
