import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { updateJobSchema } from "@/lib/validators"

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await req.json()
  const parsed = updateJobSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "参数错误" }, { status: 400 })
  }
  const { appliedAt, ...rest } = parsed.data
  const data: Record<string, unknown> = { ...rest }
  if (appliedAt) data.appliedAt = new Date(appliedAt)

  const job = await prisma.jobApplication.update({ where: { id }, data })
  return NextResponse.json(job)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  await prisma.jobApplication.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
