import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getSession } from "@/lib/session"
import { updateWebsiteFolderSchema } from "@/lib/validators"

export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store" }

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const folder = await prisma.websiteFolder.findFirst({
    where: { id },
    include: {
      _count: { select: { websites: true } },
      user: { select: { id: true, displayName: true, email: true, avatarText: true, avatarUrl: true } },
    },
  })
  if (!folder) {
    return NextResponse.json({ error: "文件夹不存在" }, { status: 404, headers: NO_STORE })
  }
  return NextResponse.json(folder, { headers: NO_STORE })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "请先登录" }, { status: 401, headers: NO_STORE })

  const { id } = await params
  const existing = await prisma.websiteFolder.findFirst({
    where: { id, userId: session.userId },
  })
  if (!existing) {
    return NextResponse.json({ error: "文件夹不存在" }, { status: 404, headers: NO_STORE })
  }

  const body = await req.json().catch(() => null)
  const parsed = updateWebsiteFolderSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "参数错误", detail: parsed.error.flatten() },
      { status: 400, headers: NO_STORE }
    )
  }

  const { name, description } = parsed.data

  if (name && name !== existing.name) {
    const dup = await prisma.websiteFolder.findFirst({
      where: { userId: session.userId, name, id: { not: id } },
    })
    if (dup) {
      return NextResponse.json({ error: "已存在同名文件夹" }, { status: 409, headers: NO_STORE })
    }
  }

  const folder = await prisma.websiteFolder.update({
    where: { id },
    data: { ...(name !== undefined ? { name } : {}), ...(description !== undefined ? { description } : {}) },
  })

  return NextResponse.json(folder, { headers: NO_STORE })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "请先登录" }, { status: 401, headers: NO_STORE })

  const { id } = await params
  const existing = await prisma.websiteFolder.findFirst({
    where: { id, userId: session.userId },
  })
  if (!existing) {
    return NextResponse.json({ error: "文件夹不存在" }, { status: 404, headers: NO_STORE })
  }

  await prisma.websiteFolder.delete({ where: { id } })
  return NextResponse.json({ ok: true }, { headers: NO_STORE })
}
