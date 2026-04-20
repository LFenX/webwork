import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { updateInterviewSchema } from "@/lib/validators"

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await req.json()
  const parsed = updateInterviewSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "参数错误" }, { status: 400 })
  }
  const { scheduledAt, ...rest } = parsed.data
  const data: Record<string, unknown> = { ...rest }
  if (scheduledAt) data.scheduledAt = new Date(scheduledAt)

  const record = await prisma.interviewRecord.update({ where: { id }, data })
  return NextResponse.json(record)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  await prisma.interviewRecord.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
