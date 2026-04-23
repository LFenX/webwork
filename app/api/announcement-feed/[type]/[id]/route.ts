import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getSession } from "@/lib/session"

export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store" }

async function ensureTarget(type: string, id: string) {
  if (type === "announcement") {
    return prisma.announcement.findFirst({ where: { id, source: "admin" }, select: { id: true } })
  }
  if (type === "broadcast") {
    return prisma.worldBroadcast.findUnique({ where: { id }, select: { id: true } })
  }
  return null
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ type: string; id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "未登录" }, { status: 401, headers: NO_STORE })
  const { type, id } = await params
  if (!(await ensureTarget(type, id))) return NextResponse.json({ error: "内容不存在" }, { status: 404, headers: NO_STORE })

  if (type === "announcement") {
    await prisma.announcementView.upsert({
      where: { announcementId_userId: { announcementId: id, userId: session.userId } },
      create: { announcementId: id, userId: session.userId, viewCount: 1, lastViewedAt: new Date() },
      update: { viewCount: { increment: 1 }, lastViewedAt: new Date() },
    })
  } else {
    await prisma.worldBroadcastView.upsert({
      where: { broadcastId_userId: { broadcastId: id, userId: session.userId } },
      create: { broadcastId: id, userId: session.userId, viewCount: 1, hidden: true, lastViewedAt: new Date() },
      update: { viewCount: { increment: 1 }, hidden: true, lastViewedAt: new Date() },
    })
  }

  return NextResponse.json({ ok: true }, { headers: NO_STORE })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ type: string; id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "未登录" }, { status: 401, headers: NO_STORE })
  const { type, id } = await params
  if (!(await ensureTarget(type, id))) return NextResponse.json({ error: "内容不存在" }, { status: 404, headers: NO_STORE })
  const body = await req.json().catch(() => ({}))
  const hidden = Boolean(body.hidden)

  if (type === "announcement") {
    await prisma.announcementView.upsert({
      where: { announcementId_userId: { announcementId: id, userId: session.userId } },
      create: { announcementId: id, userId: session.userId, hidden, lastViewedAt: new Date() },
      update: { hidden, lastViewedAt: new Date() },
    })
  } else {
    await prisma.worldBroadcastView.upsert({
      where: { broadcastId_userId: { broadcastId: id, userId: session.userId } },
      create: { broadcastId: id, userId: session.userId, hidden, lastViewedAt: new Date() },
      update: { hidden, lastViewedAt: new Date() },
    })
  }

  return NextResponse.json({ ok: true }, { headers: NO_STORE })
}
