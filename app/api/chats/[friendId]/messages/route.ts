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

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const NO_STORE = { "Cache-Control": "no-store" }

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ friendId: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "未登录" }, { status: 401, headers: NO_STORE })

  const { friendId } = await params
  const friend = await getFriendOrNull(session.userId, friendId)
  if (!friend) return NextResponse.json({ error: "只能查看好友聊天" }, { status: 403, headers: NO_STORE })

  const limit = Math.min(Math.max(Number(req.nextUrl.searchParams.get("limit") ?? 50), 1), 50)
  const cursor = req.nextUrl.searchParams.get("cursor")
  const before = cursor ? new Date(cursor) : null

  const messages = await prisma.chatMessage.findMany({
    where: {
      OR: [
        { senderId: session.userId, receiverId: friendId },
        { senderId: friendId, receiverId: session.userId },
      ],
      ...(before && !Number.isNaN(before.getTime()) ? { createdAt: { lt: before } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { attachments: { select: { id: true, originalName: true, mimeType: true, size: true } } },
  })

  await prisma.chatMessage.updateMany({
    where: { senderId: friendId, receiverId: session.userId, readAt: null },
    data: { readAt: new Date() },
  }).catch(() => null)

  const items = messages.reverse().map(serializeMessage)
  return NextResponse.json({
    friend,
    items,
    nextCursor: messages.length === limit ? messages[0]?.createdAt.toISOString() ?? null : null,
  }, { headers: NO_STORE })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ friendId: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "未登录" }, { status: 401, headers: NO_STORE })

  const { friendId } = await params
  const friend = await getFriendOrNull(session.userId, friendId)
  if (!friend) return NextResponse.json({ error: "只能给好友发送消息" }, { status: 403, headers: NO_STORE })

  const form = await req.formData()
  const text = String(form.get("text") ?? "").trim().slice(0, CHAT_TEXT_MAX_LENGTH)
  const files = form.getAll("files").filter((item): item is File => item instanceof File && item.size > 0)

  if (!text && files.length === 0) {
    return NextResponse.json({ error: "请输入消息或选择文件" }, { status: 400, headers: NO_STORE })
  }

  const totalSize = files.reduce((sum, file) => sum + file.size, 0)
  const tooLarge = files.find((file) => file.size > CHAT_FILE_MAX_SIZE)
  if (tooLarge) return NextResponse.json({ error: "单个文件不能超过 20MB" }, { status: 413, headers: NO_STORE })
  if (!(await canStoreChatBytes(session.userId, totalSize))) {
    return NextResponse.json({ error: "已超出 200MB 存储配额" }, { status: 413, headers: NO_STORE })
  }

  const message = await prisma.chatMessage.create({
    data: { senderId: session.userId, receiverId: friendId, text },
    include: { attachments: { select: { id: true, originalName: true, mimeType: true, size: true } } },
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
      originalName: file.name || "未命名文件",
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
    include: { attachments: { select: { id: true, originalName: true, mimeType: true, size: true } } },
  })
  const payload = serializeMessage(created)
  publishChatMessage(payload)

  return NextResponse.json(payload, { status: 201, headers: NO_STORE })
}
