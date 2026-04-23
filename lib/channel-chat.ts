import path from "node:path"
import { prisma } from "@/lib/db"

export const WORLD_CHANNEL_ID = "world"

export type ChannelMessagePayload = {
  id: string
  channelId: string
  senderId: string
  sender: {
    id: string
    email: string
    displayName: string
    avatarText: string
    avatarUrl: string | null
  }
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
  createdAt: string
  attachments: {
    id: string
    originalName: string
    mimeType: string
    size: number
    downloadUrl: string
  }[]
}

export async function ensureWorldChannel() {
  return prisma.chatChannel.upsert({
    where: { id: WORLD_CHANNEL_ID },
    update: {},
    create: {
      id: WORLD_CHANNEL_ID,
      type: "world",
      name: "世界频道",
    },
  })
}

export async function getChannelForUser(userId: string, channelId: string) {
  const channel = channelId === WORLD_CHANNEL_ID
    ? await ensureWorldChannel()
    : await prisma.chatChannel.findUnique({ where: { id: channelId } })
  if (!channel) return null
  if (channel.type === "world") return channel

  const member = await prisma.chatChannelMember.findUnique({
    where: { channelId_userId: { channelId: channel.id, userId } },
    select: { id: true },
  })
  return member ? channel : null
}

export function channelStorageRoot() {
  return path.join(/*turbopackIgnore: true*/ process.cwd(), "storage", "channel-attachments")
}

export function safeChannelStoragePath(storagePath: string) {
  if (!storagePath || storagePath.includes("\0")) return null
  const root = channelStorageRoot()
  const filePath = path.join(root, storagePath)
  const relative = path.relative(root, filePath)
  if (relative.startsWith("..") || path.isAbsolute(relative)) return null
  return filePath
}

type ChannelMessageWithRelations = {
  id: string
  channelId: string
  senderId: string
  text: string
  createdAt: Date
  sender: {
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
}

export function serializeChannelMessage(message: ChannelMessageWithRelations): ChannelMessagePayload {
  return {
    id: message.id,
    channelId: message.channelId,
    senderId: message.senderId,
    sender: message.sender,
    text: message.text,
    stickerId: message.stickerId,
    stickerEmoji: message.stickerEmoji,
    sticker: message.sticker ? { ...message.sticker, url: `/api/stickers/${message.sticker.id}/file` } : null,
    createdAt: message.createdAt.toISOString(),
    attachments: message.attachments.map((attachment) => ({
      id: attachment.id,
      originalName: attachment.originalName,
      mimeType: attachment.mimeType,
      size: attachment.size,
      downloadUrl: `/api/channels/attachments/${attachment.id}/download`,
    })),
  }
}
