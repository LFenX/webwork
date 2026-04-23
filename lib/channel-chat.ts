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

export type ChannelListItem = {
  id: string
  type: string
  name: string
  announcement: string
  ownerId: string | null
  ownerName: string | null
  currentUserRole: "owner" | "member" | null
  members: Array<{
    id: string
    email: string
    displayName: string
    avatarText: string
    avatarUrl: string | null
  }>
}

export type GroupChannelDetails = {
  id: string
  type: string
  name: string
  announcement: string
  ownerId: string | null
  ownerName: string | null
  currentUserRole: "owner" | "member"
  members: Array<{
    id: string
    email: string
    displayName: string
    avatarText: string
    avatarUrl: string | null
    role: string
  }>
}

export async function ensureWorldChannel() {
  return prisma.chatChannel.upsert({
    where: { id: WORLD_CHANNEL_ID },
    update: {},
    create: {
      id: WORLD_CHANNEL_ID,
      type: "world",
      name: "世界频道",
      announcement: "",
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

export async function getGroupChannelDetails(userId: string, channelId: string): Promise<GroupChannelDetails | null> {
  if (channelId === WORLD_CHANNEL_ID) return null
  const channel = await prisma.chatChannel.findUnique({
    where: { id: channelId },
    include: {
      createdBy: { select: { id: true, displayName: true, email: true } },
      members: {
        orderBy: { joinedAt: "asc" },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              displayName: true,
              avatarText: true,
              avatarUrl: true,
            },
          },
        },
      },
    },
  })
  if (!channel || channel.type !== "group") return null
  const currentMembership = channel.members.find((member) => member.userId === userId)
  if (!currentMembership) return null

  return {
    id: channel.id,
    type: channel.type,
    name: channel.name,
    announcement: channel.announcement,
    ownerId: channel.createdById,
    ownerName: channel.createdBy?.displayName || channel.createdBy?.email || null,
    currentUserRole: currentMembership.role === "owner" ? "owner" : "member",
    members: channel.members.map((member) => ({
      id: member.user.id,
      email: member.user.email,
      displayName: member.user.displayName,
      avatarText: member.user.avatarText,
      avatarUrl: member.user.avatarUrl,
      role: member.role,
    })),
  }
}

export async function listChannelsForUser(userId: string): Promise<ChannelListItem[]> {
  const world = await ensureWorldChannel()
  const groups = await prisma.chatChannel.findMany({
    where: {
      type: "group",
      members: { some: { userId } },
    },
    orderBy: { updatedAt: "desc" },
    include: {
      createdBy: { select: { id: true, displayName: true, email: true } },
      members: {
        include: {
          user: { select: { id: true, email: true, displayName: true, avatarText: true, avatarUrl: true } },
        },
        orderBy: { joinedAt: "asc" },
      },
    },
  })

  return [
    {
      id: world.id,
      type: world.type,
      name: world.name,
      announcement: "",
      ownerId: null,
      ownerName: null,
      currentUserRole: null,
      members: [],
    },
    ...groups.map<ChannelListItem>((channel) => {
      const currentMembership = channel.members.find((member) => member.userId === userId)
      return {
        id: channel.id,
        type: channel.type,
        name: channel.name,
        announcement: channel.announcement,
        ownerId: channel.createdById,
        ownerName: channel.createdBy?.displayName || channel.createdBy?.email || null,
        currentUserRole: currentMembership?.role === "owner" ? "owner" : "member",
        members: channel.members.map((member) => member.user),
      }
    }),
  ]
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
