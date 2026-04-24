import path from "node:path"
import { randomBytes } from "node:crypto"
import { prisma } from "@/lib/db"

export const STICKER_MAX_SIZE = 5 * 1024 * 1024
export const STICKER_SCOPES = ["custom", "public"] as const

export const DEFAULT_STICKERS = [
  "😀", "😄", "😉", "😍", "😎", "😭", "😡", "🥳",
  "🤔", "😴", "🙌", "👏", "👍", "☕", "🌈", "🔥",
  "🎉", "💯", "🙏", "😅", "🤝", "❤️", "😁", "😆",
  "😋", "😌", "😮", "🫶", "😇", "🤖", "😏", "😬",
  "💪", "👀", "🫡", "✅", "🙈", "🎯", "❌", "💥",
  "🎁", "🎵", "☀️", "🌙", "✨", "✔️", "📣", "💌",
]

export type StickerPayload = {
  id: string
  scope: string
  name: string
  originalName: string
  mimeType: string
  size: number
  isAnimated: boolean
  url: string
}

export function stickerStorageRoot() {
  return path.join(/*turbopackIgnore: true*/ process.cwd(), "storage", "stickers")
}

export function safeStickerStoragePath(storagePath: string) {
  if (!storagePath || storagePath.includes("\0")) return null
  const root = stickerStorageRoot()
  const filePath = path.join(root, storagePath)
  const relative = path.relative(root, filePath)
  if (relative.startsWith("..") || path.isAbsolute(relative)) return null
  return filePath
}

export function makeStickerFilename(originalName: string) {
  const ext = path.extname(originalName).slice(0, 16) || ".png"
  return `${Date.now()}-${randomBytes(8).toString("hex")}${ext}`
}

export function serializeSticker(sticker: {
  id: string
  scope: string
  name: string
  originalName: string
  mimeType: string
  size: number
  isAnimated: boolean
}): StickerPayload {
  return {
    ...sticker,
    url: `/api/stickers/${sticker.id}/file`,
  }
}

export async function canUseSticker(userId: string, stickerId: string) {
  const sticker = await prisma.stickerAsset.findFirst({
    where: {
      id: stickerId,
      OR: [{ scope: "public" }, { ownerId: userId }],
    },
    select: { id: true },
  })
  return Boolean(sticker)
}

export async function canAccessStickerAsset(userId: string, stickerId: string) {
  const sticker = await prisma.stickerAsset.findUnique({
    where: { id: stickerId },
    select: { id: true, scope: true, ownerId: true },
  })
  if (!sticker) return false
  if (sticker.scope === "public" || sticker.ownerId === userId) return true

  const [chatUsage, channelUsage, commentUsage, guestbookUsage] = await Promise.all([
    prisma.chatMessage.findFirst({
      where: {
        stickerId,
        OR: [{ senderId: userId }, { receiverId: userId }],
      },
      select: { id: true },
    }),
    prisma.channelMessage.findFirst({
      where: {
        stickerId,
        channel: {
          OR: [
            { type: "world" },
            { members: { some: { userId } } },
          ],
        },
      },
      select: { id: true },
    }),
    prisma.comment.findFirst({
      where: {
        stickerId,
        OR: [{ authorId: userId }, { post: { userId } }],
      },
      select: { id: true },
    }),
    prisma.guestbookMessage.findFirst({
      where: {
        stickerId,
        OR: [{ authorId: userId }, { ownerId: userId }],
      },
      select: { id: true },
    }),
  ])

  return Boolean(chatUsage || channelUsage || commentUsage || guestbookUsage)
}
