import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { publishUserPageChanged } from "@/lib/realtime-events"
import { createJobSchema } from "@/lib/validators"
import { getSession } from "@/lib/session"

export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store" }

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "未登录" }, { status: 401, headers: NO_STORE })

  const { searchParams } = req.nextUrl
  const status = searchParams.get("status")
  const q = searchParams.get("q")
  const from = searchParams.get("from")
  const to = searchParams.get("to")
  const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? 50), 1), 50)
  const offset = Math.max(Number(searchParams.get("cursor") ?? 0), 0)

  const where: Record<string, unknown> = { userId: session.userId }
  if (status) where.status = status
  if (from || to) {
    where.appliedAt = {}
    if (from) (where.appliedAt as Record<string, unknown>).gte = new Date(from)
    if (to) (where.appliedAt as Record<string, unknown>).lte = new Date(to)
  }

  const jobs = await prisma.jobApplication.findMany({
    where,
    orderBy: { appliedAt: "desc" },
    include: { _count: { select: { interviews: true } } },
  })

  const terms = q?.trim().toLowerCase().split(/\s+/).filter(Boolean) ?? []
  const filteredJobs = terms.length === 0
    ? jobs
    : jobs.filter((job) => {
        const haystack = [
          job.company,
          job.position,
          job.channel,
          job.status,
          job.baseLocation,
          job.hrContact,
          job.link,
          job.notes,
          job.appliedAt.toISOString(),
          job.appliedAt.toLocaleDateString("zh-CN", { timeZone: "Asia/Shanghai" }),
          String(job._count.interviews),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
        return terms.every((term) => haystack.includes(term))
      })

  const items = filteredJobs.slice(offset, offset + limit)
  const hasMore = filteredJobs.length > offset + limit

  return NextResponse.json({
    items,
    nextCursor: hasMore ? String(offset + items.length) : null,
    hasMore,
  }, { headers: NO_STORE })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "未登录" }, { status: 401, headers: NO_STORE })

  const body = await req.json()
  const parsed = createJobSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "参数错误", detail: parsed.error.flatten() }, { status: 400 })
  }
  const { appliedAt, ...rest } = parsed.data
  const job = await prisma.jobApplication.create({
    data: { ...rest, userId: session.userId, appliedAt: new Date(appliedAt) },
  })
  await publishUserPageChanged(session.userId, "jobs")
  return NextResponse.json(job, { status: 201, headers: NO_STORE })
}
