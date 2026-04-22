import { NextRequest, NextResponse } from "next/server"
import crypto from "node:crypto"
import { prisma } from "@/lib/db"
import { getSession } from "@/lib/session"
import { commentSchema } from "@/lib/validators"
import { getAccessLevel } from "@/lib/permissions"

export const dynamic = "force-dynamic"

const NO_STORE = { "Cache-Control": "no-store" }

async function getAccessiblePost(id: string, viewerId: string) {
  const post = await prisma.post.findUnique({
    where: { id },
    select: { id: true, userId: true, visibility: true },
  })
  if (!post) return null

  const level = await getAccessLevel(viewerId, post.userId)
  if (level === "self") return post
  if (level === "friend" && post.visibility === "friends") return post
  return null
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "未登录" }, { status: 401, headers: NO_STORE })

  const { id } = await params
  const post = await getAccessiblePost(id, session.userId)
  if (!post) return NextResponse.json({ error: "无权查看评论" }, { status: 403, headers: NO_STORE })

  const comments = await prisma.comment.findMany({
    where: { postId: id },
    orderBy: { createdAt: "asc" },
    include: { author: { select: { id: true, email: true, displayName: true, avatarText: true, avatarUrl: true } } },
  })

  return NextResponse.json(
    comments.map((comment) => ({
      id: comment.id,
      content: comment.content,
      createdAt: comment.createdAt.toISOString(),
      author: comment.author,
    })),
    { headers: NO_STORE }
  )
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "未登录" }, { status: 401, headers: NO_STORE })

  const { id } = await params
  const post = await getAccessiblePost(id, session.userId)
  if (!post) return NextResponse.json({ error: "无权评论" }, { status: 403, headers: NO_STORE })

  const body = await req.json().catch(() => null)
  const parsed = commentSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().formErrors[0] ?? "评论不能为空" }, { status: 400, headers: NO_STORE })
  }

  const comment = await prisma.comment.create({
    data: {
      id: crypto.randomUUID(),
      postId: id,
      authorId: session.userId,
      content: parsed.data.content,
    },
    include: { author: { select: { id: true, email: true, displayName: true, avatarText: true, avatarUrl: true } } },
  })

  return NextResponse.json(
    {
      id: comment.id,
      content: comment.content,
      createdAt: comment.createdAt.toISOString(),
      author: comment.author,
    },
    { status: 201, headers: NO_STORE }
  )
}
