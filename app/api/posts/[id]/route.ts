import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { updatePostSchema } from "@/lib/validators"
import { revalidatePath } from "next/cache"
import { getSession } from "@/lib/session"

export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store" }

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "未登录" }, { status: 401, headers: NO_STORE })

  const { id } = await params
  const post = await prisma.post.findFirst({ where: { id, userId: session.userId } })
  if (!post) return NextResponse.json({ error: "未找到" }, { status: 404, headers: NO_STORE })
  return NextResponse.json(
    { ...post, tags: JSON.parse(post.tags || "[]"), date: post.date.toISOString() },
    { headers: NO_STORE }
  )
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "未登录" }, { status: 401, headers: NO_STORE })

  const { id } = await params
  const existing = await prisma.post.findFirst({ where: { id, userId: session.userId } })
  if (!existing) return NextResponse.json({ error: "未找到" }, { status: 404, headers: NO_STORE })

  const body = await req.json()
  const parsed = updatePostSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "参数错误" }, { status: 400 })
  }
  const { tags, date, visibility, ...rest } = parsed.data
  const data: Record<string, unknown> = { ...rest }
  if (tags !== undefined) data.tags = JSON.stringify(tags)
  if (date) data.date = new Date(date)
  if (visibility !== undefined) data.visibility = visibility

  const post = await prisma.post.update({ where: { id }, data })
  revalidatePath(`/${post.type}`)
  revalidatePath(`/${post.type}/${post.slug}`)
  revalidatePath("/")
  revalidatePath("/", "layout")
  return NextResponse.json(
    { ...post, tags: JSON.parse(post.tags || "[]"), date: post.date.toISOString() },
    { headers: NO_STORE }
  )
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "未登录" }, { status: 401, headers: NO_STORE })

  const { id } = await params
  const post = await prisma.post.findFirst({ where: { id, userId: session.userId }, select: { type: true, slug: true } })
  if (!post) return NextResponse.json({ error: "未找到" }, { status: 404, headers: NO_STORE })

  await prisma.post.delete({ where: { id } })
  revalidatePath(`/${post.type}`)
  revalidatePath("/")
  return NextResponse.json({ ok: true }, { headers: NO_STORE })
}
