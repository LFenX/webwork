import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { publishUserPageChanged } from "@/lib/realtime-events"
import { createJobSchema } from "@/lib/validators"
import { getSession } from "@/lib/session"
import { hasJobReplySignal } from "@/lib/job-stats"

export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store" }

type SortKey = "created" | "applied" | "company"

const SORT_MAP: Record<SortKey, { orderBy: { [K: string]: "asc" | "desc" }[] }> = {
  created: { orderBy: [{ priority: "desc" }, { createdAt: "desc" }] },
  applied: { orderBy: [{ priority: "desc" }, { appliedAt: "desc" }] },
  company: { orderBy: [{ company: "asc" }] },
}

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "未登录" }, { status: 401, headers: NO_STORE })

  const { searchParams } = req.nextUrl
  const statusParam = searchParams.getAll("status").filter(Boolean)
  const channelParam = searchParams.getAll("channel").filter(Boolean)
  const locationParam = searchParams.getAll("location").filter(Boolean)
  const companyParam = searchParams.getAll("company").filter(Boolean)
  const stageParam = searchParams.getAll("stage")
    .map((v) => Number(v))
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 5)
  const q = searchParams.get("q")
  const from = searchParams.get("from")
  const to = searchParams.get("to")
  const archivedParam = (searchParams.get("archived") ?? "0").toLowerCase()
  const priorityOnly = searchParams.get("priority") === "1"
  const sortParam = (searchParams.get("sort") ?? "created") as SortKey
  const sort: SortKey = sortParam in SORT_MAP ? sortParam : "created"
  const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? 50), 1), 50)
  const offset = Math.max(Number(searchParams.get("cursor") ?? 0), 0)

  const where: Record<string, unknown> = { userId: session.userId }
  if (statusParam.length === 1) where.status = statusParam[0]
  else if (statusParam.length > 1) where.status = { in: statusParam }
  if (channelParam.length === 1) where.channel = channelParam[0]
  else if (channelParam.length > 1) where.channel = { in: channelParam }
  if (locationParam.length === 1) where.baseLocation = locationParam[0]
  else if (locationParam.length > 1) where.baseLocation = { in: locationParam }
  if (companyParam.length === 1) where.company = companyParam[0]
  else if (companyParam.length > 1) where.company = { in: companyParam }
  if (stageParam.length === 1) where.pipelineStage = stageParam[0]
  else if (stageParam.length > 1) where.pipelineStage = { in: stageParam }
  if (priorityOnly) where.priority = { gt: 0 }
  if (archivedParam === "1") where.archivedAt = { not: null }
  else if (archivedParam !== "all") where.archivedAt = null
  if (from || to) {
    where.appliedAt = {}
    if (from) (where.appliedAt as Record<string, unknown>).gte = new Date(from)
    if (to) (where.appliedAt as Record<string, unknown>).lte = new Date(to)
  }

  const jobs = await prisma.jobApplication.findMany({
    where,
    orderBy: SORT_MAP[sort].orderBy,
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
          job.jobDescription,
          job.salaryRange,
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
  const { appliedAt, nextActionAt, ...rest } = parsed.data
  const repliedAt = hasJobReplySignal({ status: rest.status, pipelineStage: rest.pipelineStage ?? 0 }) ? new Date() : null
  const job = await prisma.jobApplication.create({
    data: {
      ...rest,
      userId: session.userId,
      appliedAt: new Date(appliedAt),
      nextActionAt: nextActionAt ? new Date(nextActionAt) : null,
      repliedAt,
    },
  })
  await publishUserPageChanged(session.userId, "jobs")
  return NextResponse.json(job, { status: 201, headers: NO_STORE })
}
