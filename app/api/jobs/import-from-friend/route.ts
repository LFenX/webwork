import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { canViewModule, getAccessLevel } from "@/lib/permissions"
import { getSession } from "@/lib/session"

export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store" }

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "未登录" }, { status: 401, headers: NO_STORE })

  const body = await req.json().catch(() => null) as { ownerId?: string; jobIds?: string[] } | null
  const ownerId = body?.ownerId
  const jobIds = Array.from(new Set(body?.jobIds ?? [])).filter(Boolean)
  if (!ownerId || jobIds.length === 0) {
    return NextResponse.json({ error: "参数错误" }, { status: 400, headers: NO_STORE })
  }

  const level = await getAccessLevel(session.userId, ownerId)
  if (level !== "friend" || !(await canViewModule(ownerId, "jobs", level))) {
    return NextResponse.json({ error: "无权导入" }, { status: 403, headers: NO_STORE })
  }

  const jobs = await prisma.jobApplication.findMany({
    where: { id: { in: jobIds }, userId: ownerId },
    orderBy: { appliedAt: "desc" },
  })
  if (jobs.length === 0) return NextResponse.json({ imported: 0 }, { headers: NO_STORE })

  await prisma.jobApplication.createMany({
    data: jobs.map((job) => ({
      userId: session.userId,
      company: job.company,
      position: job.position,
      channel: job.channel,
      appliedAt: job.appliedAt,
      status: job.status,
      repliedAt: job.repliedAt,
      notes: job.notes,
      baseLocation: job.baseLocation,
      hrContact: job.hrContact,
      link: job.link,
      jobDescription: job.jobDescription,
      salaryRange: job.salaryRange,
    })),
  })

  return NextResponse.json({ imported: jobs.length }, { headers: NO_STORE })
}
