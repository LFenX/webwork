"use client"

import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { toast } from "sonner"
import { getActiveChatContext } from "@/lib/active-chat"
import { getDict } from "@/lib/i18n"

type RealtimeEvent = {
  type: string
  createdAt: string
  data: unknown
}

type ChatToastMessage = {
  id?: string
  senderId?: string
  receiverId?: string
  text?: string
  sticker?: unknown
  stickerEmoji?: string | null
  attachments?: Array<{ mimeType?: string; originalName?: string }>
  sender?: { displayName?: string | null; email?: string | null }
}

type RoutedUserUpdate = {
  userId?: string
  scope?: string
}

function asChatMessage(value: unknown): ChatToastMessage | null {
  return value && typeof value === "object" ? (value as ChatToastMessage) : null
}

function asUserUpdate(value: unknown): RoutedUserUpdate | null {
  return value && typeof value === "object" ? (value as RoutedUserUpdate) : null
}

function messagePreview(message: ChatToastMessage, n: ReturnType<typeof getDict>["notifications"]) {
  if (typeof message.text === "string" && message.text.trim()) return message.text.trim()
  if (message.sticker || message.stickerEmoji) return n.sticker
  if (Array.isArray(message.attachments) && message.attachments.length > 0) {
    const first = message.attachments[0]
    if (first?.mimeType?.startsWith("image/")) return n.image
    return first?.originalName || n.attachment
  }
  return n.newMessage
}

function isOwnWorkspacePath(pathname: string) {
  return (
    pathname === "/" ||
    pathname === "/blog" ||
    pathname.startsWith("/blog/") ||
    pathname === "/daily" ||
    pathname.startsWith("/daily/") ||
    pathname === "/notes" ||
    pathname.startsWith("/notes/") ||
    pathname === "/reflections" ||
    pathname.startsWith("/reflections/") ||
    pathname === "/jobs" ||
    pathname.startsWith("/jobs/") ||
    pathname === "/interviews" ||
    pathname.startsWith("/interviews/") ||
    pathname === "/resume" ||
    pathname.startsWith("/resume/")
  )
}

function shouldRefreshUserPath(pathname: string, currentUserId: string, payload: RoutedUserUpdate | null) {
  const targetUserId = payload?.userId
  if (!targetUserId) return false
  if (pathname === `/u/${targetUserId}` || pathname.startsWith(`/u/${targetUserId}/`)) return true
  if (targetUserId === currentUserId && isOwnWorkspacePath(pathname)) return true
  return false
}

export function RealtimeNotifications({ userId }: { userId: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const dict = getDict()
  const n = dict.notifications

  useEffect(() => {
    const source = new EventSource("/api/realtime/events")
    source.addEventListener("realtime", (event) => {
      const payload = JSON.parse((event as MessageEvent).data) as RealtimeEvent
      window.dispatchEvent(new CustomEvent("app:realtime", { detail: payload }))

      if (payload.type === "presence:changed") {
        window.dispatchEvent(new CustomEvent("presence-refresh", { detail: payload.data }))
        return
      }

      if (payload.type === "admin:activity-changed") {
        window.dispatchEvent(new CustomEvent("admin-activities-refresh", { detail: payload.data }))
        return
      }

      if (payload.type === "admin:permissions-changed") {
        const update = asUserUpdate(payload.data)
        if (update?.userId === userId || pathname.startsWith("/admin")) router.refresh()
        return
      }

      if (payload.type === "site:user-updated") {
        const update = asUserUpdate(payload.data)
        if (shouldRefreshUserPath(pathname, userId, update)) router.refresh()
        return
      }

      if (payload.type === "chat:read") {
        window.dispatchEvent(new CustomEvent("chat-read", { detail: payload.data }))
        window.dispatchEvent(new CustomEvent("chat-unread-refresh"))
        return
      }

      if (payload.type !== "chat:message") return
      const message = asChatMessage(payload.data)
      if (!message || message.receiverId !== userId || message.senderId === userId) return

      const activeContext = getActiveChatContext()
      if (activeContext?.kind === "direct" && activeContext.id === message.senderId) {
        return
      }

      window.dispatchEvent(new CustomEvent("chat-unread-refresh"))

      const chatPath = `/friends/chat/${message.senderId}`
      if (pathname === chatPath) return

      const senderName = message.sender?.displayName || message.sender?.email || "Friend"
      toast(`${n.from} ${senderName}`, {
        description: messagePreview(message, n),
        action: {
          label: n.open,
          onClick: () => router.push(chatPath),
        },
      })
    })

    return () => source.close()
  }, [pathname, router, userId])

  return null
}
