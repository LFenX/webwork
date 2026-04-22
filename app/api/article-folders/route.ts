import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getSession } from "@/lib/session"
import { articleFolderSchema } from "@/lib/validators"

export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store" }

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "未登录" }, { status: 401, headers: NO_STORE })

  const type = req.nextUrl.searchParams.get("type")
  if (!type || !["blog", "daily", "reflections", "notes"].includes(type)) {
    return NextResponse.json({ error: "参数错误" }, { status: 400, headers: NO_STORE })
  }

  const folders = await prisma.articleFolder.findMany({
    where: { userId: session.userId, type },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { posts: true } } },
  })
  return NextResponse.json(
    folders.map((folder) => ({ ...folder, postCount: folder._count.posts })),
    { headers: NO_STORE }
  )
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "未登录" }, { status: 401, headers: NO_STORE })

  const body = await req.json().catch(() => null)
  const parsed = articleFolderSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "参数错误" }, { status: 400, headers: NO_STORE })

  const folder = await prisma.articleFolder.create({
    data: { ...parsed.data, userId: session.userId },
  })
  return NextResponse.json(folder, { status: 201, headers: NO_STORE })
}
