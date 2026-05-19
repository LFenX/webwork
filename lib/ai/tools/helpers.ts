import "server-only"
import { getPresenceMap } from "@/lib/presence"
import { getAccessLevel, canViewModule, visibleTo, type AccessLevel, type ModuleKey } from "@/lib/permissions"
import { prisma } from "@/lib/db"
import type { AIToolStructuredResult } from "@/lib/ai/types"

export async function resolveUserReference(reference: string | null | undefined) {
  const value = reference?.trim()
  if (!value) return null

  const exact = await prisma.user.findFirst({
    where: {
      OR: [{ id: value }, { email: value.toLowerCase() }, { publicSlug: value.toLowerCase() }],
    },
    select: {
      id: true,
      email: true,
      publicSlug: true,
      displayName: true,
      avatarText: true,
      avatarUrl: true,
    },
  })
  if (exact) return exact

  const fuzzy = await prisma.user.findFirst({
    where: {
      OR: [
        { displayName: { contains: value, mode: "insensitive" } },
        { email: { contains: value.toLowerCase(), mode: "insensitive" } },
        { publicSlug: { contains: value.toLowerCase(), mode: "insensitive" } },
      ],
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      email: true,
      publicSlug: true,
      displayName: true,
      avatarText: true,
      avatarUrl: true,
    },
  })

  return fuzzy
}

export function previewText(value: string, size = 80) {
  const text = value.replace(/\s+/g, " ").trim()
  if (text.length <= size) return text
  return `${text.slice(0, size)}...`
}

export function summarizeGeoLocation(value: string) {
  if (!value) return ""
  const parts = value.split("/").map((part) => part.trim()).filter(Boolean)
  if (parts.length <= 2) return parts.join(" / ")
  return parts.slice(0, 2).join(" / ")
}

export function toolGranted<TData>(summary: string, data: TData): AIToolStructuredResult<TData> {
  return {
    ok: true,
    access: "granted",
    summary,
    data,
  }
}

export function toolPartial<TData>(summary: string, data: TData, reason?: string): AIToolStructuredResult<TData> {
  return {
    ok: true,
    access: "partial",
    summary,
    data,
    ...(reason ? { reason } : {}),
  }
}

export function toolForbidden(summary: string, reason: string, data: Record<string, unknown> | null = null): AIToolStructuredResult<Record<string, unknown>> {
  return {
    ok: false,
    access: "forbidden",
    summary,
    data,
    reason,
  }
}

export function toolNotFound(summary: string, reason: string, data: Record<string, unknown> | null = null): AIToolStructuredResult<Record<string, unknown>> {
  return {
    ok: false,
    access: "not_found",
    summary,
    data,
    reason,
  }
}

export function isStructuredToolResult(value: unknown): value is AIToolStructuredResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  return "ok" in value && "access" in value && "summary" in value && "data" in value
}

export async function getFriendProfileSnapshot(ownerUserId: string, friendId: string) {
  const friendship = await prisma.friendship.findFirst({
    where: {
      OR: [
        { userAId: ownerUserId, userBId: friendId },
        { userAId: friendId, userBId: ownerUserId },
      ],
    },
    include: {
      userA: {
        select: {
          id: true,
          email: true,
          displayName: true,
          bio: true,
          avatarText: true,
          avatarUrl: true,
          location: true,
        },
      },
      userB: {
        select: {
          id: true,
          email: true,
          displayName: true,
          bio: true,
          avatarText: true,
          avatarUrl: true,
          location: true,
        },
      },
    },
  })

  if (!friendship) return null

  const friend = friendship.userAId === ownerUserId ? friendship.userB : friendship.userA
  const [presenceMap, latestMessage] = await Promise.all([
    getPresenceMap([friend.id]),
    prisma.chatMessage.findFirst({
      where: {
        OR: [
          { senderId: ownerUserId, receiverId: friend.id },
          { senderId: friend.id, receiverId: ownerUserId },
        ],
      },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
  ])

  return {
    id: friend.id,
    email: friend.email,
    displayName: friend.displayName,
    bio: friend.bio,
    avatarText: friend.avatarText,
    avatarUrl: friend.avatarUrl,
    location: friend.location,
    friendedAt: friendship.createdAt.toISOString(),
    lastInteractionAt: latestMessage?.createdAt.toISOString() ?? null,
    presenceStatus: presenceMap.get(friend.id) ?? "offline",
  }
}

export async function getVisibleUserAccess(viewerId: string, ownerId: string, module?: ModuleKey) {
  const level = await getAccessLevel(viewerId, ownerId)
  const moduleVisible = module ? await canViewModule(ownerId, module, level) : true

  return {
    ownerId,
    viewerId,
    level,
    module: module ?? null,
    moduleVisible,
    visibilities: visibleTo(level),
  }
}

export function explainVisibilityDenial(level: AccessLevel, module?: ModuleKey) {
  if (level === "public") {
    return module
      ? `当前用户只能访问目标用户公开内容，无法访问其 ${module} 模块。`
      : "当前用户只能访问目标用户公开内容。"
  }

  return module
    ? `目标用户没有向当前用户开放 ${module} 模块。`
    : "当前请求的内容对当前用户不可见。"
}
