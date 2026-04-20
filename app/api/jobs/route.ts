import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { createJobSchema } from "@/lib/validators"

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const status = searchParams.get("status")
  const q = searchParams.get("q")
  const from = searchParams.get("from")
  const to = searchParams.get("to")

  const where: Record<string, unknown> = {}
  if (status) where.status = status
  if (q) {
    where.OR = [
      { company: { contains: q } },
      { position: { contains: q } },
    ]
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
  return NextResponse.json(jobs)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const parsed = createJobSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "参数错误", detail: parsed.error.flatten() }, { status: 400 })
  }
  const { appliedAt, ...rest } = parsed.data
  const job = await prisma.jobApplication.create({
    data: { ...rest, appliedAt: new Date(appliedAt) },
  })
  return NextResponse.json(job, { status: 201 })
}
