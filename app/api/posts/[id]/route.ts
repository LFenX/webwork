import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { updatePostSchema } from "@/lib/validators"
import { revalidatePath } from "next/cache"

export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store" }

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const post = await prisma.post.findUnique({ where: { id } })
  if (!post) return NextResponse.json({ error: "未找到" }, { status: 404 })
  return NextResponse.json(
    { ...post, tags: JSON.parse(post.tags || "[]"), date: post.date.toISOString() },
    { headers: NO_STORE }
  )
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await req.json()
  const parsed = updatePostSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "参数错误" }, { status: 400 })
  }
  const { tags, date, ...rest } = parsed.data
  const data: Record<string, unknown> = { ...rest }
  if (tags !== undefined) data.tags = JSON.stringify(tags)
  if (date) data.date = new Date(date)

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
  const { id } = await params
  const post = await prisma.post.findUnique({ where: { id }, select: { type: true, slug: true } })
  await prisma.post.delete({ where: { id } })
  if (post) {
    revalidatePath(`/${post.type}`)
    revalidatePath("/")
  }
  return NextResponse.json({ ok: true }, { headers: NO_STORE })
}
