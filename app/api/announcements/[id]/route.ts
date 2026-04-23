import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { requireAdminPermission } from "@/lib/admin"
import { getSession } from "@/lib/session"

export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store" }

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "未登录" }, { status: 401, headers: NO_STORE })

  const { id } = await params
  const exists = await prisma.announcement.findUnique({ where: { id }, select: { id: true } })
  if (!exists) return NextResponse.json({ error: "公告不存在" }, { status: 404, headers: NO_STORE })

  const view = await prisma.announcementView.upsert({
    where: { announcementId_userId: { announcementId: id, userId: session.userId } },
    update: { viewCount: { increment: 1 }, lastViewedAt: new Date() },
    create: { announcementId: id, userId: session.userId, viewCount: 1, lastViewedAt: new Date() },
  })

  return NextResponse.json({ viewCount: view.viewCount, hidden: view.hidden }, { headers: NO_STORE })
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "未登录" }, { status: 401, headers: NO_STORE })

  const { id } = await params
  const body = await req.json().catch(() => null)
  if (body?.hidden !== true) return NextResponse.json({ error: "参数错误" }, { status: 400, headers: NO_STORE })

  await prisma.announcementView.upsert({
    where: { announcementId_userId: { announcementId: id, userId: session.userId } },
    update: { hidden: true },
    create: { announcementId: id, userId: session.userId, hidden: true, viewCount: 3 },
  })

  return NextResponse.json({ ok: true }, { headers: NO_STORE })
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdminPermission("manageAnnouncements").catch(() => null)
  if (!admin) return NextResponse.json({ error: "无权限" }, { status: 403, headers: NO_STORE })

  const { id } = await params
  await prisma.announcement.delete({ where: { id } }).catch(() => null)
  return NextResponse.json({ ok: true }, { headers: NO_STORE })
}
