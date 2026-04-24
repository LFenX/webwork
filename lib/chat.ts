import path from "node:path"
import { randomBytes } from "node:crypto"
import { prisma } from "@/lib/db"
import { USER_QUOTA } from "@/lib/upload"
import { getPresenceMap } from "@/lib/presence"

export const CHAT_FILE_MAX_SIZE = 20 * 1024 * 1024
export const CHAT_TEXT_MAX_LENGTH = 5000

export type ChatMessagePayload = {
  id: string
  senderId: string
  receiverId: string
  text: string
  stickerId?: string | null
  stickerEmoji?: string | null
  sticker?: {
    id: string
    scope: string
    name: string
    originalName: string
    mimeType: string
    size: number
    isAnimated: boolean
    url?: string
  } | null
  readAt: string | null
  createdAt: string
  sender?: {
    id: string
    email: string
    displayName: string
    avatarText: string
    avatarUrl: string | null
  }
  replyTo?: {
    id: string
    senderId: string
    text: string
    stickerEmoji?: string | null
    sticker?: {
      id: string
      url: string
      name?: string
      originalName?: string
      isAnimated?: boolean
    } | null
    attachments: {
      id: string
      originalName: string
      mimeType: string
      size: number
      downloadUrl: string
    }[]
    sender?: {
      id: string
      email: string
      displayName: string
      avatarText: string
      avatarUrl: string | null
    }
  } | null
  attachments: {
    id: string
    originalName: string
    mimeType: string
    size: number
    downloadUrl: string
  }[]
}

export function orderedPair(a: string, b: string) {
  return a < b ? [a, b] as const : [b, a] as const
}

export async function areFriends(userId: string, friendId: string) {
  const [userAId, userBId] = orderedPair(userId, friendId)
  const friendship = await prisma.friendship.findUnique({
    where: { userAId_userBId: { userAId, userBId } },
    select: { id: true },
  })
  return Boolean(friendship)
}

export async function getFriendOrNull(userId: string, friendId: string) {
  if (userId === friendId) return null
  const [friend, friendship] = await Promise.all([
    prisma.user.findUnique({
      where: { id: friendId },
      select: { id: true, email: true, displayName: true, avatarText: true, avatarUrl: true },
    }),
    areFriends(userId, friendId),
  ])
  if (!friend || !friendship) return null
  const presence = await getPresenceMap([friend.id])
  return { ...friend, presenceStatus: presence.get(friend.id) ?? "offline" }
}

type MessageWithAttachments = {
  id: string
  senderId: string
  receiverId: string
  text: string
  stickerId?: string | null
  stickerEmoji?: string | null
  sticker?: {
    id: string
    scope: string
    name: string
    originalName: string
    mimeType: string
    size: number
    isAnimated: boolean
    url?: string
  } | null
  readAt: Date | null
  createdAt: Date
  sender?: {
    id: string
    email: string
    displayName: string
    avatarText: string
    avatarUrl: string | null
  }
  replyTo?: {
    id: string
    senderId: string
    text: string
    stickerEmoji?: string | null
    sticker?: {
      id: string
      scope: string
      name: string
      originalName: string
      mimeType: string
      size: number
      isAnimated: boolean
      url?: string
    } | null
    sender?: {
      id: string
      email: string
      displayName: string
      avatarText: string
      avatarUrl: string | null
    }
    attachments: {
      id: string
      originalName: string
      mimeType: string
      size: number
    }[]
  } | null
  attachments: {
    id: string
    originalName: string
    mimeType: string
    size: number
  }[]
}

export function serializeMessage(message: MessageWithAttachments): ChatMessagePayload {
  return {
    id: message.id,
    senderId: message.senderId,
    receiverId: message.receiverId,
    text: message.text,
    stickerId: message.stickerId,
    stickerEmoji: message.stickerEmoji,
    sticker: message.sticker ? { ...message.sticker, url: `/api/stickers/${message.sticker.id}/file` } : null,
    readAt: message.readAt?.toISOString() ?? null,
    createdAt: message.createdAt.toISOString(),
    sender: message.sender,
    replyTo: message.replyTo ? {
      id: message.replyTo.id,
      senderId: message.replyTo.senderId,
      text: message.replyTo.text,
      stickerEmoji: message.replyTo.stickerEmoji,
      sticker: message.replyTo.sticker ? {
        id: message.replyTo.sticker.id,
        url: `/api/stickers/${message.replyTo.sticker.id}/file`,
        name: message.replyTo.sticker.name,
        originalName: message.replyTo.sticker.originalName,
        isAnimated: message.replyTo.sticker.isAnimated,
      } : null,
      sender: message.replyTo.sender,
      attachments: message.replyTo.attachments.map((attachment) => ({
        id: attachment.id,
        originalName: attachment.originalName,
        mimeType: attachment.mimeType,
        size: attachment.size,
        downloadUrl: `/api/chats/attachments/${attachment.id}/download`,
      })),
    } : null,
    attachments: message.attachments.map((attachment) => ({
      id: attachment.id,
      originalName: attachment.originalName,
      mimeType: attachment.mimeType,
      size: attachment.size,
      downloadUrl: `/api/chats/attachments/${attachment.id}/download`,
    })),
  }
}

export function chatStorageRoot() {
  return path.join(/*turbopackIgnore: true*/ process.cwd(), "storage", "chat-attachments")
}

export function safeChatStoragePath(storagePath: string) {
  if (!storagePath || storagePath.includes("\0")) return null
  const root = chatStorageRoot()
  const filePath = path.join(root, storagePath)
  const relative = path.relative(root, filePath)
  if (relative.startsWith("..") || path.isAbsolute(relative)) return null
  return filePath
}

export function makeStoredFilename(originalName: string) {
  const ext = path.extname(originalName).slice(0, 32)
  return `${Date.now()}-${randomBytes(8).toString("hex")}${ext}`
}

export async function getUsedUploadBytes(userId: string) {
  const [publicUploads, chatUploads, channelUploads] = await Promise.all([
    prisma.upload.aggregate({ where: { userId }, _sum: { size: true } }),
    prisma.chatAttachment.aggregate({ where: { uploaderId: userId }, _sum: { size: true } }),
    prisma.channelAttachment.aggregate({ where: { uploaderId: userId }, _sum: { size: true } }),
  ])
  return (publicUploads._sum.size ?? 0) + (chatUploads._sum.size ?? 0) + (channelUploads._sum.size ?? 0)
}

export async function canStoreChatBytes(userId: string, size: number) {
  const used = await getUsedUploadBytes(userId)
  return used + size <= USER_QUOTA
}
