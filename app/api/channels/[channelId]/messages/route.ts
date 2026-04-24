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

const messageInclude = {
  sender: { select: { id: true, email: true, displayName: true, avatarText: true, avatarUrl: true } },
  sticker: { select: { id: true, scope: true, name: true, originalName: true, mimeType: true, size: true, isAnimated: true } },
  attachments: { select: { id: true, originalName: true, mimeType: true, size: true } },
  replyTo: {
    select: {
      id: true,
      channelId: true,
      senderId: true,
      text: true,
      stickerEmoji: true,
      sender: { select: { id: true, email: true, displayName: true, avatarText: true, avatarUrl: true } },
      sticker: { select: { id: true, scope: true, name: true, originalName: true, mimeType: true, size: true, isAnimated: true } },
      attachments: { select: { id: true, originalName: true, mimeType: true, size: true } },
    },
  },
} as const

function parseMessageCursor(cursor: string | null) {
  if (!cursor) return null
  const [createdAtRaw, id] = cursor.split("|")
  const createdAt = new Date(createdAtRaw ?? cursor)
  if (Number.isNaN(createdAt.getTime())) return null
  return { createdAt, id: id?.trim() || null }
}

function makeMessageCursor(message: { id: string; createdAt: Date } | null | undefined) {
  if (!message) return null
  return `${message.createdAt.toISOString()}|${message.id}`
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ channelId: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE })

  const { channelId } = await params
  const channel = await getChannelForUser(session.userId, channelId)
  if (!channel) return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: NO_STORE })

  const limit = Math.min(Math.max(Number(req.nextUrl.searchParams.get("limit") ?? 100), 1), 100)
  const before = parseMessageCursor(req.nextUrl.searchParams.get("cursor"))

  const messages = await prisma.channelMessage.findMany({
    where: {
      channelId,
      ...(before ? {
        OR: [
          { createdAt: { lt: before.createdAt } },
          ...(before.id ? [{ createdAt: before.createdAt, id: { lt: before.id } }] : []),
        ],
      } : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit,
    include: messageInclude,
  })

  return NextResponse.json({
    channel,
    items: messages.reverse().map(serializeChannelMessage),
    nextCursor: messages.length === limit ? makeMessageCursor(messages[messages.length - 1]) : null,
  }, { headers: NO_STORE })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ channelId: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE })

  const { channelId } = await params
  const channel = await getChannelForUser(session.userId, channelId)
  if (!channel) return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: NO_STORE })

  const form = await req.formData()
  const text = String(form.get("text") ?? "").trim().slice(0, CHAT_TEXT_MAX_LENGTH)
  const publishToAnnouncement = String(form.get("publishToAnnouncement") ?? "false") === "true"
  const stickerId = String(form.get("stickerId") ?? "").trim() || null
  const stickerEmoji = String(form.get("stickerEmoji") ?? "").trim().slice(0, 20) || null
  const replyToId = String(form.get("replyToId") ?? "").trim() || null
  const files = form.getAll("files").filter((item): item is File => item instanceof File && item.size > 0)

  if (!text && files.length === 0 && !stickerId && !stickerEmoji) {
    return NextResponse.json({ error: "Message is empty" }, { status: 400, headers: NO_STORE })
  }
  if (stickerId && !(await canUseSticker(session.userId, stickerId))) {
    return NextResponse.json({ error: "Sticker not found" }, { status: 400, headers: NO_STORE })
  }

  let replyToMessageId: string | undefined
  if (replyToId) {
    const replyTarget = await prisma.channelMessage.findFirst({
      where: { id: replyToId, channelId },
      select: { id: true },
    })
    if (!replyTarget) {
      return NextResponse.json({ error: "Reply target not found" }, { status: 400, headers: NO_STORE })
    }
    replyToMessageId = replyTarget.id
  }

  const totalSize = files.reduce((sum, file) => sum + file.size, 0)
  const tooLarge = files.find((file) => file.size > CHAT_FILE_MAX_SIZE)
  if (tooLarge) return NextResponse.json({ error: "A single file cannot exceed 20MB" }, { status: 413, headers: NO_STORE })
  if (!(await canStoreChatBytes(session.userId, totalSize))) {
    return NextResponse.json({ error: "Storage quota exceeded" }, { status: 413, headers: NO_STORE })
  }

  const message = await prisma.channelMessage.create({
    data: {
      channelId,
      senderId: session.userId,
      text,
      stickerId,
      stickerEmoji,
      ...(replyToMessageId ? { replyToId: replyToMessageId } : {}),
    },
    include: messageInclude,
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
      originalName: file.name || "file",
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
    include: messageInclude,
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
      publishRealtime(users.map((user) => user.id), {
        type: "announcement-feed:changed",
        data: { type: "broadcast", id: broadcastId },
      })
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
