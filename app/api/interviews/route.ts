import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { createInterviewSchema } from "@/lib/validators"

export async function GET() {
  const interviews = await prisma.interviewRecord.findMany({
    orderBy: { scheduledAt: "desc" },
    include: { job: { select: { company: true, position: true } } },
  })
  return NextResponse.json(interviews)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const parsed = createInterviewSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "参数错误", detail: parsed.error.flatten() }, { status: 400 })
  }
  const { scheduledAt, ...rest } = parsed.data
  const record = await prisma.interviewRecord.create({
    data: { ...rest, scheduledAt: new Date(scheduledAt) },
  })
  return NextResponse.json(record, { status: 201 })
}
