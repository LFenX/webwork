import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getGroupChannelDetails, WORLD_CHANNEL_ID } from "@/lib/channel-chat"
import { getSession } from "@/lib/session"

export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store" }

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ channelId: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE })

  const { channelId } = await params
  if (channelId === WORLD_CHANNEL_ID) return NextResponse.json({ error: "World channel cannot be left" }, { status: 400, headers: NO_STORE })

  const channel = await getGroupChannelDetails(session.userId, channelId)
  if (!channel) return NextResponse.json({ error: "Channel not found" }, { status: 404, headers: NO_STORE })
  if (channel.currentUserRole === "owner") {
    return NextResponse.json({ error: "Group owner cannot leave directly" }, { status: 400, headers: NO_STORE })
  }

  await prisma.chatChannelMember.delete({
    where: { channelId_userId: { channelId, userId: session.userId } },
  })

  return NextResponse.json({ success: true }, { headers: NO_STORE })
}
