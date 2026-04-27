import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getSession } from "@/lib/session"
import { createWebsiteFolderSchema } from "@/lib/validators"

export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store" }

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId") || undefined

  const where: Record<string, unknown> = {}
  if (userId) where.userId = userId

  const folders = await prisma.websiteFolder.findMany({
    where,
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    include: {
      _count: { select: { websites: true } },
      user: { select: { id: true, displayName: true, email: true, avatarText: true, avatarUrl: true } },
    },
  })

  return NextResponse.json({ items: folders, total: folders.length }, { headers: NO_STORE })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "请先登录" }, { status: 401, headers: NO_STORE })

  const body = await req.json().catch(() => null)
  const parsed = createWebsiteFolderSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "参数错误", detail: parsed.error.flatten() },
      { status: 400, headers: NO_STORE }
    )
  }

  const { name, description } = parsed.data

  const existing = await prisma.websiteFolder.findFirst({
    where: { userId: session.userId, name },
  })
  if (existing) {
    return NextResponse.json({ error: "已存在同名文件夹" }, { status: 409, headers: NO_STORE })
  }

  const count = await prisma.websiteFolder.count({ where: { userId: session.userId } })
  const folder = await prisma.websiteFolder.create({
    data: {
      userId: session.userId,
      name,
      description,
      sortOrder: count,
    },
    include: {
      _count: { select: { websites: true } },
    },
  })

  return NextResponse.json(folder, { status: 201, headers: NO_STORE })
}
