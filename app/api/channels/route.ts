import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { areFriends } from "@/lib/chat"
import { listChannelsForUser } from "@/lib/channel-chat"
import { getSession } from "@/lib/session"
import { channelCreateSchema } from "@/lib/validators"

export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store" }

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE })

  const items = await listChannelsForUser(session.userId)
  return NextResponse.json({ currentUserId: session.userId, items }, { headers: NO_STORE })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE })

  const body = await req.json().catch(() => null)
  const parsed = channelCreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().formErrors[0] ?? "Group name is required" }, { status: 400, headers: NO_STORE })
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
      announcement: "",
      createdById: session.userId,
      members: {
        create: [
          { userId: session.userId, role: "owner" },
          ...allowedIds.map((userId) => ({ userId, role: "member" })),
        ],
      },
    },
  })

  const items = await listChannelsForUser(session.userId)
  const created = items.find((item) => item.id === channel.id)
  return NextResponse.json(created, { status: 201, headers: NO_STORE })
}
