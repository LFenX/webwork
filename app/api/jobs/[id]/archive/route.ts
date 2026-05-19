import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { publishUserPageChanged } from "@/lib/realtime-events"
import { getSession } from "@/lib/session"

export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store" }

// 归档
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "未登录" }, { status: 401, headers: NO_STORE })

  const { id } = await params
  const existing = await prisma.jobApplication.findFirst({ where: { id, userId: session.userId } })
  if (!existing) return NextResponse.json({ error: "未找到" }, { status: 404, headers: NO_STORE })

  const job = await prisma.jobApplication.update({
    where: { id },
    data: { archivedAt: new Date() },
    include: { _count: { select: { interviews: true } } },
  })
  await publishUserPageChanged(session.userId, "jobs")
  return NextResponse.json(job, { headers: NO_STORE })
}

// 取消归档
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "未登录" }, { status: 401, headers: NO_STORE })

  const { id } = await params
  const existing = await prisma.jobApplication.findFirst({ where: { id, userId: session.userId } })
  if (!existing) return NextResponse.json({ error: "未找到" }, { status: 404, headers: NO_STORE })

  const job = await prisma.jobApplication.update({
    where: { id },
    data: { archivedAt: null },
    include: { _count: { select: { interviews: true } } },
  })
  await publishUserPageChanged(session.userId, "jobs")
  return NextResponse.json(job, { headers: NO_STORE })
}
