import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { createPostSchema } from "@/lib/validators"
import { revalidatePath } from "next/cache"
import { POST_TYPES } from "@/lib/enums"
import { getSession } from "@/lib/session"

export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store" }

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "未登录" }, { status: 401, headers: NO_STORE })

  const { searchParams } = req.nextUrl
  const type = searchParams.get("type")
  const q = searchParams.get("q")

  const where: Record<string, unknown> = { userId: session.userId }
  if (type && POST_TYPES.includes(type as never)) where.type = type
  if (q) {
    where.OR = [{ title: { contains: q } }, { summary: { contains: q } }]
  }

  const posts = await prisma.post.findMany({
    where,
    orderBy: { date: "desc" },
    select: { id: true, type: true, slug: true, title: true, summary: true, tags: true, date: true, visibility: true },
  })

  const result = posts.map((p) => ({
    ...p,
    tags: JSON.parse(p.tags || "[]") as string[],
    date: p.date.toISOString(),
  }))

  return NextResponse.json(result, { headers: NO_STORE })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "未登录" }, { status: 401, headers: NO_STORE })

  const body = await req.json()
  const parsed = createPostSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "参数错误", detail: parsed.error.flatten() }, { status: 400 })
  }
  const { tags, date, visibility, ...rest } = parsed.data
  const post = await prisma.post.create({
    data: {
      ...rest,
      userId: session.userId,
      tags: JSON.stringify(tags ?? []),
      date: date ? new Date(date) : new Date(),
      visibility: visibility ?? "private",
    },
  })
  revalidatePath(`/${rest.type}`)
  revalidatePath(`/${rest.type}/${post.slug}`)
  revalidatePath("/")
  revalidatePath("/", "layout")
  return NextResponse.json({ ...post, tags: JSON.parse(post.tags) }, { status: 201, headers: NO_STORE })
}
