import crypto from "node:crypto"
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getSession } from "@/lib/session"
import { commentSchema } from "@/lib/validators"
import { canUseSticker } from "@/lib/stickers"
import { getRequestMeta } from "@/lib/request-meta"
import { ensureUpdateLogEntry, getPublicUpdateDetail, getUpdateComments, updateCommentToDTO } from "@/lib/update-log"

export const dynamic = "force-dynamic"

const NO_STORE = { "Cache-Control": "no-store" }

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ hash: string }> }
) {
  const { hash } = await params
  const detail = await getPublicUpdateDetail(hash)
  if (!detail) return NextResponse.json({ error: "更新记录不存在或已隐藏" }, { status: 404, headers: NO_STORE })
  const comments = await getUpdateComments(detail.summary.hash)
  return NextResponse.json(comments, { headers: NO_STORE })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ hash: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "请先登录后再评论" }, { status: 401, headers: NO_STORE })

  const { hash } = await params
  const resolvedHash = await ensureUpdateLogEntry(hash)
  if (!resolvedHash) return NextResponse.json({ error: "更新记录不存在" }, { status: 404, headers: NO_STORE })

  const detail = await getPublicUpdateDetail(resolvedHash)
  if (!detail) return NextResponse.json({ error: "更新记录不存在或已隐藏" }, { status: 404, headers: NO_STORE })

  const body = await req.json().catch(() => null)
  const parsed = commentSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().formErrors[0] ?? "评论内容无效" }, { status: 400, headers: NO_STORE })
  }

  const parentId = parsed.data.parentId ?? null
  const stickerId = parsed.data.stickerId ?? null
  const stickerEmoji = parsed.data.stickerEmoji ?? null
  if (!parsed.data.content && !stickerId && !stickerEmoji) {
    return NextResponse.json({ error: "评论不能为空" }, { status: 400, headers: NO_STORE })
  }
  if (stickerId && !(await canUseSticker(session.userId, stickerId))) {
    return NextResponse.json({ error: "表情不存在或不可用" }, { status: 400, headers: NO_STORE })
  }
  if (parentId) {
    const parent = await prisma.updateLogComment.findFirst({
      where: { id: parentId, hash: resolvedHash },
      select: { id: true },
    })
    if (!parent) return NextResponse.json({ error: "回复的评论不存在" }, { status: 400, headers: NO_STORE })
  }

  const meta = await getRequestMeta(req)
  const comment = await prisma.updateLogComment.create({
    data: {
      id: crypto.randomUUID(),
      hash: resolvedHash,
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
      sticker: { select: { id: true, name: true, originalName: true, isAnimated: true } },
    },
  })

  return NextResponse.json(updateCommentToDTO(comment), { status: 201, headers: NO_STORE })
}
