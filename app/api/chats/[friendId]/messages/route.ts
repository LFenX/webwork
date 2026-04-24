import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getSession } from "@/lib/session"
import {
  CHAT_FILE_MAX_SIZE,
  CHAT_TEXT_MAX_LENGTH,
  canStoreChatBytes,
  chatStorageRoot,
  getFriendOrNull,
  makeStoredFilename,
  serializeMessage,
} from "@/lib/chat"
import { publishChatMessage } from "@/lib/chat-events"
import { publishRealtime } from "@/lib/realtime-events"
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
  { params }: { params: Promise<{ friendId: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE })

  const { friendId } = await params
  const friend = await getFriendOrNull(session.userId, friendId)
  if (!friend) return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: NO_STORE })

  const limit = Math.min(Math.max(Number(req.nextUrl.searchParams.get("limit") ?? 100), 1), 100)
  const before = parseMessageCursor(req.nextUrl.searchParams.get("cursor"))

  const messages = await prisma.chatMessage.findMany({
    where: {
      OR: [
        { senderId: session.userId, receiverId: friendId },
        { senderId: friendId, receiverId: session.userId },
      ],
      ...(before ? {
        AND: [
          {
            OR: [
              { createdAt: { lt: before.createdAt } },
              ...(before.id ? [{ createdAt: before.createdAt, id: { lt: before.id } }] : []),
            ],
          },
        ],
      } : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit,
    include: messageInclude,
  })

  const unread = await prisma.chatMessage.findMany({
    where: { senderId: friendId, receiverId: session.userId, readAt: null },
    select: { id: true },
  })

  if (unread.length > 0) {
    const readAt = new Date()
    await prisma.chatMessage.updateMany({
      where: { id: { in: unread.map((item) => item.id) } },
      data: { readAt },
    })
    publishRealtime(friendId, {
      type: "chat:read",
      data: {
        friendId: session.userId,
        readMessageIds: unread.map((item) => item.id),
        readAt: readAt.toISOString(),
      },
    })
  }

  return NextResponse.json({
    friend,
    items: messages.reverse().map(serializeMessage),
    nextCursor: messages.length === limit ? makeMessageCursor(messages[messages.length - 1]) : null,
  }, { headers: NO_STORE })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ friendId: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE })

  const { friendId } = await params
  const friend = await getFriendOrNull(session.userId, friendId)
  if (!friend) return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: NO_STORE })

  const form = await req.formData()
  const text = String(form.get("text") ?? "").trim().slice(0, CHAT_TEXT_MAX_LENGTH)
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
    const replyTarget = await prisma.chatMessage.findFirst({
      where: {
        id: replyToId,
        OR: [
          { senderId: session.userId, receiverId: friendId },
          { senderId: friendId, receiverId: session.userId },
        ],
      },
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

  const message = await prisma.chatMessage.create({
    data: {
      senderId: session.userId,
      receiverId: friendId,
      text,
      stickerId,
      stickerEmoji,
      ...(replyToMessageId ? { replyToId: replyToMessageId } : {}),
    },
    include: messageInclude,
  })

  const attachmentData = []
  const messageDir = path.join(chatStorageRoot(), message.id)
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
    await prisma.chatAttachment.createMany({ data: attachmentData })
  }

  const created = await prisma.chatMessage.findUniqueOrThrow({
    where: { id: message.id },
    include: messageInclude,
  })
  const payload = serializeMessage(created)
  publishChatMessage(payload)
  publishRealtime([session.userId, friendId], { type: "chat:message", data: payload })

  return NextResponse.json(payload, { status: 201, headers: NO_STORE })
}
