import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { updateJobSchema } from "@/lib/validators"
import { getSession } from "@/lib/session"

export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store" }

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "未登录" }, { status: 401, headers: NO_STORE })

  const { id } = await params
  const job = await prisma.jobApplication.findFirst({
    where: { id, userId: session.userId },
    include: { _count: { select: { interviews: true } } },
  })
  if (!job) return NextResponse.json({ error: "未找到" }, { status: 404, headers: NO_STORE })
  return NextResponse.json(job, { headers: NO_STORE })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "未登录" }, { status: 401, headers: NO_STORE })

  const { id } = await params
  const existing = await prisma.jobApplication.findFirst({ where: { id, userId: session.userId } })
  if (!existing) return NextResponse.json({ error: "未找到" }, { status: 404, headers: NO_STORE })

  const body = await req.json()
  const parsed = updateJobSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "参数错误" }, { status: 400 })

  const { appliedAt, ...rest } = parsed.data
  const data: Record<string, unknown> = { ...rest }
  if (appliedAt) data.appliedAt = new Date(appliedAt)

  const job = await prisma.jobApplication.update({ where: { id }, data })
  return NextResponse.json(job, { headers: NO_STORE })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "未登录" }, { status: 401, headers: NO_STORE })

  const { id } = await params
  const existing = await prisma.jobApplication.findFirst({ where: { id, userId: session.userId } })
  if (!existing) return NextResponse.json({ error: "未找到" }, { status: 404, headers: NO_STORE })

  await prisma.jobApplication.delete({ where: { id } })
  return NextResponse.json({ ok: true }, { headers: NO_STORE })
}
