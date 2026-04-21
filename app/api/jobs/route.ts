import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
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

  const where: Record<string, unknown> = { userId: session.userId }
  if (status) where.status = status
  if (q) {
    where.OR = [{ company: { contains: q } }, { position: { contains: q } }]
  }
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
  return NextResponse.json(jobs, { headers: NO_STORE })
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
  return NextResponse.json(job, { status: 201, headers: NO_STORE })
}
