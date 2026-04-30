import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { listChannelsForUser } from "@/lib/channel-chat"
import { getSession } from "@/lib/session"

export const dynamic = "force-dynamic"

const NO_STORE = { "Cache-Control": "no-store" }

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE })

  const channels = await listChannelsForUser(session.userId)
  const items = await Promise.all(channels.map(async (channel) => {
    const [totalCount, latest] = await Promise.all([
      prisma.channelMessage.count({ where: { channelId: channel.id } }),
      prisma.channelMessage.findFirst({
        where: { channelId: channel.id },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: { id: true, text: true, createdAt: true },
      }),
    ])
    return {
      channelId: channel.id,
      totalCount,
      latest: latest ? {
        id: latest.id,
        text: latest.text,
        createdAt: latest.createdAt.toISOString(),
      } : null,
    }
  }))

  return NextResponse.json({ items }, { headers: NO_STORE })
}
