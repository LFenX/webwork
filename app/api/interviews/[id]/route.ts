import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { publishUserPageChanged } from "@/lib/realtime-events"
import { updateInterviewSchema } from "@/lib/validators"
import { getSession } from "@/lib/session"

export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store" }

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "未登录" }, { status: 401, headers: NO_STORE })

  const { id } = await params
  const existing = await prisma.interviewRecord.findFirst({ where: { id, userId: session.userId } })
  if (!existing) return NextResponse.json({ error: "未找到" }, { status: 404, headers: NO_STORE })

  const body = await req.json()
  const parsed = updateInterviewSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "参数错误" }, { status: 400 })

  const { scheduledAt, ...rest } = parsed.data
  if (rest.jobId) {
    const job = await prisma.jobApplication.findFirst({ where: { id: rest.jobId, userId: session.userId }, select: { id: true } })
    if (!job) return NextResponse.json({ error: "关联投递不存在" }, { status: 400, headers: NO_STORE })
  }
  const data: Record<string, unknown> = { ...rest }
  if (scheduledAt) data.scheduledAt = new Date(scheduledAt)

  const record = await prisma.interviewRecord.update({ where: { id }, data })
  await publishUserPageChanged(session.userId, "interviews")
  return NextResponse.json(record, { headers: NO_STORE })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "未登录" }, { status: 401, headers: NO_STORE })

  const { id } = await params
  const existing = await prisma.interviewRecord.findFirst({ where: { id, userId: session.userId } })
  if (!existing) return NextResponse.json({ error: "未找到" }, { status: 404, headers: NO_STORE })

  await prisma.interviewRecord.delete({ where: { id } })
  await publishUserPageChanged(session.userId, "interviews")
  return NextResponse.json({ ok: true }, { headers: NO_STORE })
}
