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

function asChatMessage(value: unknown): ChatToastMessage | null {
  return value && typeof value === "object" ? (value as ChatToastMessage) : null
}

function messagePreview(message: ChatToastMessage) {
  if (typeof message?.text === "string" && message.text.trim()) return message.text.trim()
  if (message?.sticker || message?.stickerEmoji) return "[表情]"
  if (Array.isArray(message?.attachments) && message.attachments.length > 0) return "[文件]"
  return "收到一条新消息"
}

export function RealtimeNotifications({ userId }: { userId: string }) {
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    const source = new EventSource("/api/realtime/events")
    source.addEventListener("realtime", (event) => {
      const payload = JSON.parse((event as MessageEvent).data) as RealtimeEvent
      window.dispatchEvent(new CustomEvent("app:realtime", { detail: payload }))

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
