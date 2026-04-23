"use client"

import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { toast } from "sonner"

type RealtimeEvent = {
  type: string
  createdAt: string
  data: unknown
}

type ChatToastMessage = {
  senderId?: string
  receiverId?: string
  text?: string
  sticker?: unknown
  stickerEmoji?: string | null
  attachments?: unknown[]
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

function messagePreview(message: ChatToastMessage) {
  if (typeof message?.text === "string" && message.text.trim()) return message.text.trim()
  if (message?.sticker || message?.stickerEmoji) return "[表情]"
  if (Array.isArray(message?.attachments) && message.attachments.length > 0) return "[文件]"
  return "收到一条新消息"
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
        if (update?.userId === userId || pathname.startsWith("/admin")) {
          router.refresh()
        }
        return
      }

      if (payload.type === "site:user-updated") {
        const update = asUserUpdate(payload.data)
        if (shouldRefreshUserPath(pathname, userId, update)) {
          router.refresh()
        }
        return
      }

      if (payload.type !== "chat:message") return
      const message = asChatMessage(payload.data)
      if (!message || message.receiverId !== userId || message.senderId === userId) return
      window.dispatchEvent(new CustomEvent("chat-unread-refresh"))
      const chatPath = `/friends/chat/${message.senderId}`
      if (pathname === chatPath) return

      const senderName = message.sender?.displayName || message.sender?.email || "好友"
      toast(`来自 ${senderName} 的消息`, {
        description: messagePreview(message),
        action: {
          label: "查看",
          onClick: () => router.push(chatPath),
        },
      })
    })

    return () => source.close()
  }, [pathname, router, userId])

  return null
}
