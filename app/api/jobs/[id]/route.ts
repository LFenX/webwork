import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { publishUserPageChanged } from "@/lib/realtime-events"
import { updateJobSchema } from "@/lib/validators"
import { getSession } from "@/lib/session"
import { hasJobReplySignal, NO_REPLY_ABANDON_STATUS } from "@/lib/job-stats"

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

  const { appliedAt, nextActionAt, ...rest } = parsed.data
  const data: Record<string, unknown> = { ...rest }
  if (appliedAt !== undefined) data.appliedAt = new Date(appliedAt)
  if (nextActionAt !== undefined) data.nextActionAt = nextActionAt ? new Date(nextActionAt) : null

  // 状态变化时，把流程阶段往前推一档（不会倒退）：未通过评估 → 测评(1)；进入面试/未通过面试 → 面试(3)；已Offer → Offer(4)；已接受 → 入职(5)
  if (data.status !== undefined && data.pipelineStage === undefined) {
    const stageByStatus: Record<string, number> = { 未通过评估: 1, 进入面试: 3, 未通过面试: 3, 已Offer: 4, 已接受: 5 }
    const target = stageByStatus[data.status as string]
    if (target !== undefined && target > (existing.pipelineStage ?? 0)) {
      data.pipelineStage = target
    }
  }

  if (data.status !== undefined || data.pipelineStage !== undefined) {
    const nextStatus = (data.status as string | undefined) ?? existing.status
    const nextStage = (data.pipelineStage as number | undefined) ?? existing.pipelineStage
    if (nextStatus === "已投递" || nextStatus === NO_REPLY_ABANDON_STATUS) {
      data.repliedAt = null
    } else if (hasJobReplySignal({ status: nextStatus, pipelineStage: nextStage, repliedAt: existing.repliedAt })) {
      data.repliedAt = existing.repliedAt ?? new Date()
    }
  }

  const job = await prisma.jobApplication.update({
    where: { id },
    data,
    include: { _count: { select: { interviews: true } } },
  })
  await publishUserPageChanged(session.userId, "jobs")
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
  await publishUserPageChanged(session.userId, "jobs")
  return NextResponse.json({ ok: true }, { headers: NO_STORE })
}
