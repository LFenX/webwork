import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { publishUserPageChanged } from "@/lib/realtime-events"
import { createInterviewSchema } from "@/lib/validators"
import { getSession } from "@/lib/session"

export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store" }

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "未登录" }, { status: 401, headers: NO_STORE })

  const interviews = await prisma.interviewRecord.findMany({
    where: { userId: session.userId },
    orderBy: { scheduledAt: "desc" },
    include: { job: { select: { company: true, position: true } } },
  })
  return NextResponse.json(interviews, { headers: NO_STORE })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "未登录" }, { status: 401, headers: NO_STORE })

  const body = await req.json()
  const parsed = createInterviewSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "参数错误", detail: parsed.error.flatten() }, { status: 400 })
  }
  const { scheduledAt, ...rest } = parsed.data
  if (rest.jobId) {
    const job = await prisma.jobApplication.findFirst({ where: { id: rest.jobId, userId: session.userId }, select: { id: true } })
    if (!job) return NextResponse.json({ error: "关联投递不存在" }, { status: 400, headers: NO_STORE })
  }
  const record = await prisma.interviewRecord.create({
    data: { ...rest, userId: session.userId, scheduledAt: new Date(scheduledAt) },
  })
  await publishUserPageChanged(session.userId, "interviews")
  return NextResponse.json(record, { status: 201, headers: NO_STORE })
}
