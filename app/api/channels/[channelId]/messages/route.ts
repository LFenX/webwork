import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import {
  CHAT_FILE_MAX_SIZE,
  CHAT_TEXT_MAX_LENGTH,
  canStoreChatBytes,
  makeStoredFilename,
} from "@/lib/chat"
import {
  channelStorageRoot,
  getChannelForUser,
  serializeChannelMessage,
  WORLD_CHANNEL_ID,
} from "@/lib/channel-chat"
import { publishChannelMessage } from "@/lib/channel-events"
import { publishRealtime } from "@/lib/realtime-events"
import { getSession } from "@/lib/session"
import { canUseSticker } from "@/lib/stickers"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const NO_STORE = { "Cache-Control": "no-store" }

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ channelId: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "未登录" }, { status: 401, headers: NO_STORE })

  const { channelId } = await params
  const channel = await getChannelForUser(session.userId, channelId)
  if (!channel) return NextResponse.json({ error: "无权限查看频道" }, { status: 403, headers: NO_STORE })

  const limit = Math.min(Math.max(Number(req.nextUrl.searchParams.get("limit") ?? 50), 1), 50)
  const cursor = req.nextUrl.searchParams.get("cursor")
  const before = cursor ? new Date(cursor) : null

  const messages = await prisma.channelMessage.findMany({
    where: {
      channelId,
      ...(before && !Number.isNaN(before.getTime()) ? { createdAt: { lt: before } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      sender: { select: { id: true, email: true, displayName: true, avatarText: true, avatarUrl: true } },
      sticker: { select: { id: true, scope: true, name: true, originalName: true, mimeType: true, size: true, isAnimated: true } },
      attachments: { select: { id: true, originalName: true, mimeType: true, size: true } },
    },
  })

  return NextResponse.json({
    channel,
    items: messages.reverse().map(serializeChannelMessage),
    nextCursor: messages.length === limit ? messages[0]?.createdAt.toISOString() ?? null : null,
  }, { headers: NO_STORE })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ channelId: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "未登录" }, { status: 401, headers: NO_STORE })

  const { channelId } = await params
  const channel = await getChannelForUser(session.userId, channelId)
  if (!channel) return NextResponse.json({ error: "无权限发送频道消息" }, { status: 403, headers: NO_STORE })

  const form = await req.formData()
  const text = String(form.get("text") ?? "").trim().slice(0, CHAT_TEXT_MAX_LENGTH)
  const publishToAnnouncement = String(form.get("publishToAnnouncement") ?? "false") === "true"
  const stickerId = String(form.get("stickerId") ?? "").trim() || null
  const stickerEmoji = String(form.get("stickerEmoji") ?? "").trim().slice(0, 20) || null
  const files = form.getAll("files").filter((item): item is File => item instanceof File && item.size > 0)

  if (!text && files.length === 0 && !stickerId && !stickerEmoji) {
    return NextResponse.json({ error: "请输入消息或选择文件" }, { status: 400, headers: NO_STORE })
  }
  if (stickerId && !(await canUseSticker(session.userId, stickerId))) {
    return NextResponse.json({ error: "表情包不存在" }, { status: 400, headers: NO_STORE })
  }

  const totalSize = files.reduce((sum, file) => sum + file.size, 0)
  const tooLarge = files.find((file) => file.size > CHAT_FILE_MAX_SIZE)
  if (tooLarge) return NextResponse.json({ error: "单个文件不能超过 20MB" }, { status: 413, headers: NO_STORE })
  if (!(await canStoreChatBytes(session.userId, totalSize))) {
    return NextResponse.json({ error: "已超出 200MB 存储配额" }, { status: 413, headers: NO_STORE })
  }

  const message = await prisma.channelMessage.create({
    data: { channelId, senderId: session.userId, text, stickerId, stickerEmoji },
    include: {
      sender: { select: { id: true, email: true, displayName: true, avatarText: true, avatarUrl: true } },
      sticker: { select: { id: true, scope: true, name: true, originalName: true, mimeType: true, size: true, isAnimated: true } },
      attachments: { select: { id: true, originalName: true, mimeType: true, size: true } },
    },
  })

  const attachmentData = []
  const messageDir = path.join(channelStorageRoot(), message.id)
  await mkdir(messageDir, { recursive: true })

  for (const file of files) {
    const filename = makeStoredFilename(file.name || "file")
    const storagePath = path.join(message.id, filename)
    await writeFile(path.join(messageDir, filename), Buffer.from(await file.arrayBuffer()))
    attachmentData.push({
      messageId: message.id,
      uploaderId: session.userId,
      filename,
      originalName: file.name || "未命名文件",
      mimeType: file.type || "application/octet-stream",
      size: file.size,
      storagePath,
    })
  }

  if (attachmentData.length > 0) {
    await prisma.channelAttachment.createMany({ data: attachmentData })
  }

  const created = await prisma.channelMessage.findUniqueOrThrow({
    where: { id: message.id },
    include: {
      sender: { select: { id: true, email: true, displayName: true, avatarText: true, avatarUrl: true } },
      sticker: { select: { id: true, scope: true, name: true, originalName: true, mimeType: true, size: true, isAnimated: true } },
      attachments: { select: { id: true, originalName: true, mimeType: true, size: true } },
    },
  })

  let broadcastId: string | null = null
  if (channelId === WORLD_CHANNEL_ID && publishToAnnouncement && text) {
    const broadcast = await prisma.worldBroadcast.create({
      data: {
        authorId: session.userId,
        content: text.slice(0, 500),
        channelId,
        messageId: created.id,
      },
      select: { id: true },
    })
    broadcastId = broadcast.id
  }

  const payload = serializeChannelMessage(created)
  publishChannelMessage(payload)

  if (channelId === WORLD_CHANNEL_ID) {
    const users = await prisma.user.findMany({ select: { id: true } })
    publishRealtime(users.map((user) => user.id), { type: "channel:message", data: payload })
    if (broadcastId) {
      publishRealtime(users.map((user) => user.id), { type: "announcement-feed:changed", data: { type: "broadcast", id: broadcastId } })
    }
  } else {
    const members = await prisma.chatChannelMember.findMany({
      where: { channelId },
      select: { userId: true },
    })
    publishRealtime(members.map((member) => member.userId), { type: "channel:message", data: payload })
  }

  return NextResponse.json(payload, { status: 201, headers: NO_STORE })
}
