import { NextRequest, NextResponse } from "next/server"
import crypto from "node:crypto"
import { prisma } from "@/lib/db"
import { getSession } from "@/lib/session"
import { commentSchema } from "@/lib/validators"
import { getAccessLevel } from "@/lib/permissions"
import { canUseSticker } from "@/lib/stickers"
import { getRequestMeta } from "@/lib/request-meta"

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
    include: {
      author: { select: { id: true, email: true, displayName: true, avatarText: true, avatarUrl: true } },
      sticker: { select: { id: true, scope: true, name: true, originalName: true, mimeType: true, size: true, isAnimated: true } },
    },
  })

  return NextResponse.json(
    comments.map((comment) => ({
      id: comment.id,
      content: comment.content,
      parentId: comment.parentId,
      stickerId: comment.stickerId,
      stickerEmoji: comment.stickerEmoji,
      ipAddress: comment.ipAddress,
      geoLocation: comment.geoLocation,
      sticker: comment.sticker ? { ...comment.sticker, url: `/api/stickers/${comment.sticker.id}/file` } : null,
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

  const parentId = parsed.data.parentId ?? null
  const stickerId = parsed.data.stickerId ?? null
  const stickerEmoji = parsed.data.stickerEmoji ?? null
  if (!parsed.data.content && !stickerId && !stickerEmoji) {
    return NextResponse.json({ error: "评论不能为空" }, { status: 400, headers: NO_STORE })
  }
  if (stickerId && !(await canUseSticker(session.userId, stickerId))) {
    return NextResponse.json({ error: "表情包不存在" }, { status: 400, headers: NO_STORE })
  }
  if (parentId) {
    const parent = await prisma.comment.findFirst({
      where: { id: parentId, postId: id },
      select: { id: true },
    })
    if (!parent) return NextResponse.json({ error: "回复的评论不存在" }, { status: 400, headers: NO_STORE })
  }

  const meta = await getRequestMeta(req)
  const comment = await prisma.comment.create({
    data: {
      id: crypto.randomUUID(),
      postId: id,
      authorId: session.userId,
      parentId,
      content: parsed.data.content,
      stickerId,
      stickerEmoji,
      ipAddress: meta.ipAddress,
      geoLocation: meta.geoLocation,
    },
    include: {
      author: { select: { id: true, email: true, displayName: true, avatarText: true, avatarUrl: true } },
      sticker: { select: { id: true, scope: true, name: true, originalName: true, mimeType: true, size: true, isAnimated: true } },
    },
  })

  return NextResponse.json(
    {
      id: comment.id,
      content: comment.content,
      parentId: comment.parentId,
      stickerId: comment.stickerId,
      stickerEmoji: comment.stickerEmoji,
      ipAddress: comment.ipAddress,
      geoLocation: comment.geoLocation,
      sticker: comment.sticker ? { ...comment.sticker, url: `/api/stickers/${comment.sticker.id}/file` } : null,
      createdAt: comment.createdAt.toISOString(),
      author: comment.author,
    },
    { status: 201, headers: NO_STORE }
  )
}
