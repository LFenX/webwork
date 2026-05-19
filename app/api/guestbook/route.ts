import { NextRequest, NextResponse } from "next/server"
import crypto from "node:crypto"
import { prisma } from "@/lib/db"
import { getSession } from "@/lib/session"
import { areFriends, getAccessLevel } from "@/lib/permissions"
import { guestbookMessageSchema } from "@/lib/validators"
import { canUseSticker } from "@/lib/stickers"
import { getRequestMeta } from "@/lib/request-meta"

export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store" }

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "未登录" }, { status: 401, headers: NO_STORE })

  const ownerId = req.nextUrl.searchParams.get("ownerId")
  if (!ownerId) return NextResponse.json({ error: "缺少 ownerId" }, { status: 400, headers: NO_STORE })

  const level = await getAccessLevel(session.userId, ownerId)
  if (level === "public") return NextResponse.json({ error: "无权查看" }, { status: 403, headers: NO_STORE })

  const messages = await prisma.guestbookMessage.findMany({
    where: { ownerId },
    orderBy: { createdAt: "desc" },
    include: {
      author: { select: { id: true, displayName: true, email: true, avatarText: true, avatarUrl: true } },
      sticker: { select: { id: true, scope: true, name: true, originalName: true, mimeType: true, size: true, isAnimated: true } },
    },
  })

  return NextResponse.json(
    messages.map((m) => ({
      id: m.id,
      content: m.content,
      parentId: m.parentId,
      stickerId: m.stickerId,
      stickerEmoji: m.stickerEmoji,
      ipAddress: m.ipAddress,
      geoLocation: m.geoLocation,
      sticker: m.sticker ? { ...m.sticker, url: `/api/stickers/${m.sticker.id}/file` } : null,
      createdAt: m.createdAt.toISOString(),
      author: m.author,
    })),
    { headers: NO_STORE }
  )
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "未登录" }, { status: 401, headers: NO_STORE })

  const body = await req.json().catch(() => null)
  const parsed = guestbookMessageSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().formErrors[0] ?? "参数错误" },
      { status: 400, headers: NO_STORE }
    )
  }

  const { ownerId, content, parentId, stickerId, stickerEmoji } = parsed.data
  if (!content && !stickerId && !stickerEmoji) {
    return NextResponse.json({ error: "留言不能为空" }, { status: 400, headers: NO_STORE })
  }
  if (stickerId && !(await canUseSticker(session.userId, stickerId))) {
    return NextResponse.json({ error: "表情包不存在" }, { status: 400, headers: NO_STORE })
  }

  const friends = await areFriends(session.userId, ownerId)
  if (!friends && session.userId !== ownerId) {
    return NextResponse.json({ error: "只有好友或主页所有者才能留言" }, { status: 403, headers: NO_STORE })
  }

  if (parentId) {
    const parent = await prisma.guestbookMessage.findFirst({
      where: { id: parentId, ownerId },
      select: { id: true },
    })
    if (!parent) return NextResponse.json({ error: "回复的留言不存在" }, { status: 400, headers: NO_STORE })
  }

  const meta = await getRequestMeta(req)
  const message = await prisma.guestbookMessage.create({
    data: {
      id: crypto.randomUUID(),
      ownerId,
      authorId: session.userId,
      parentId: parentId ?? null,
      content,
      stickerId: stickerId ?? null,
      stickerEmoji: stickerEmoji ?? null,
      ipAddress: meta.ipAddress,
      geoLocation: meta.geoLocation,
    },
    include: {
      author: { select: { id: true, displayName: true, email: true, avatarText: true, avatarUrl: true } },
      sticker: { select: { id: true, scope: true, name: true, originalName: true, mimeType: true, size: true, isAnimated: true } },
    },
  })

  return NextResponse.json(
    {
      id: message.id,
      content: message.content,
      parentId: message.parentId,
      stickerId: message.stickerId,
      stickerEmoji: message.stickerEmoji,
      ipAddress: message.ipAddress,
      geoLocation: message.geoLocation,
      sticker: message.sticker ? { ...message.sticker, url: `/api/stickers/${message.sticker.id}/file` } : null,
      createdAt: message.createdAt.toISOString(),
      author: message.author,
    },
    { status: 201, headers: NO_STORE }
  )
}
