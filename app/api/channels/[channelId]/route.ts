import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getGroupChannelDetails, WORLD_CHANNEL_ID } from "@/lib/channel-chat"
import { getSession } from "@/lib/session"
import { channelManageSchema } from "@/lib/validators"

export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store" }

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ channelId: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE })

  const { channelId } = await params
  const channel = await getGroupChannelDetails(session.userId, channelId)
  if (!channel) return NextResponse.json({ error: "Channel not found" }, { status: 404, headers: NO_STORE })
  return NextResponse.json(channel, { headers: NO_STORE })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ channelId: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE })

  const { channelId } = await params
  if (channelId === WORLD_CHANNEL_ID) return NextResponse.json({ error: "World channel cannot be edited" }, { status: 400, headers: NO_STORE })

  const channel = await getGroupChannelDetails(session.userId, channelId)
  if (!channel) return NextResponse.json({ error: "Channel not found" }, { status: 404, headers: NO_STORE })
  if (channel.currentUserRole !== "owner") {
    return NextResponse.json({ error: "Only the group owner can edit group info" }, { status: 403, headers: NO_STORE })
  }

  const body = await req.json().catch(() => null)
  const parsed = channelManageSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400, headers: NO_STORE })

  await prisma.chatChannel.update({
    where: { id: channelId },
    data: {
      ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
      ...(parsed.data.announcement !== undefined ? { announcement: parsed.data.announcement } : {}),
    },
  })

  const updated = await getGroupChannelDetails(session.userId, channelId)
  return NextResponse.json(updated, { headers: NO_STORE })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ channelId: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE })

  const { channelId } = await params
  if (channelId === WORLD_CHANNEL_ID) return NextResponse.json({ error: "World channel cannot be dissolved" }, { status: 400, headers: NO_STORE })

  const channel = await getGroupChannelDetails(session.userId, channelId)
  if (!channel) return NextResponse.json({ error: "Channel not found" }, { status: 404, headers: NO_STORE })
  if (channel.currentUserRole !== "owner") {
    return NextResponse.json({ error: "Only the group owner can dissolve the group" }, { status: 403, headers: NO_STORE })
  }

  await prisma.chatChannel.delete({ where: { id: channelId } })
  return NextResponse.json({ success: true }, { headers: NO_STORE })
}
