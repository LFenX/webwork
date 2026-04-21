import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { createPostSchema } from "@/lib/validators"
import { revalidatePath } from "next/cache"
import { POST_TYPES } from "@/lib/enums"

export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store" }

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const type = searchParams.get("type")
  const q = searchParams.get("q")

  const where: Record<string, unknown> = {}
  if (type && POST_TYPES.includes(type as never)) where.type = type
  if (q) {
    where.OR = [
      { title: { contains: q } },
      { summary: { contains: q } },
    ]
  }

  const posts = await prisma.post.findMany({
    where,
    orderBy: { date: "desc" },
    select: { id: true, type: true, slug: true, title: true, summary: true, tags: true, date: true },
  })

  const result = posts.map((p) => ({
    ...p,
    tags: JSON.parse(p.tags || "[]") as string[],
    date: p.date.toISOString(),
  }))

  return NextResponse.json(result, { headers: NO_STORE })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const parsed = createPostSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "参数错误", detail: parsed.error.flatten() }, { status: 400 })
  }
  const { tags, date, ...rest } = parsed.data
  const post = await prisma.post.create({
    data: {
      ...rest,
      tags: JSON.stringify(tags ?? []),
      date: date ? new Date(date) : new Date(),
    },
  })
  revalidatePath(`/${rest.type}`)
  revalidatePath("/")
  revalidatePath("/", "layout")
  return NextResponse.json({ ...post, tags: JSON.parse(post.tags) }, { status: 201, headers: NO_STORE })
}
