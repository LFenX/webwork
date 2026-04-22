"use client"

import { useCallback, useRef, useState } from "react"
import { Trash2 } from "lucide-react"
import { toast } from "sonner"
import { UserAvatar } from "@/components/user-avatar"

type Author = {
  id: string
  displayName: string
  email: string
  avatarText: string
  avatarUrl: string | null
}

type Message = {
  id: string
  content: string
  createdAt: string
  author: Author
}

type Props = {
  ownerId: string
  initialMessages: Message[]
  /** viewer is the site owner — can delete messages */
  isOwner: boolean
  /** viewer is a friend of the owner — can post */
  canPost: boolean
}

function formatRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "刚刚"
  if (mins < 60) return `${mins} 分钟前`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} 小时前`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} 天前`
  return new Date(iso).toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" })
}

export function GuestbookSection({ ownerId, initialMessages, isOwner, canPost }: Props) {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [text, setText] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSubmit = useCallback(async () => {
    const content = text.trim()
    if (!content) return
    setSubmitting(true)
    try {
      const res = await fetch("/api/guestbook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerId, content }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error ?? "留言失败")
        return
      }
      const msg: Message = await res.json()
      setMessages((prev) => [msg, ...prev])
      setText("")
      textareaRef.current?.focus()
    } finally {
      setSubmitting(false)
    }
  }, [text, ownerId])

  const handleDelete = useCallback(async (id: string) => {
    const res = await fetch(`/api/guestbook/${id}`, { method: "DELETE" })
    if (!res.ok) {
      toast.error("删除失败")
      return
    }
    setMessages((prev) => prev.filter((m) => m.id !== id))
  }, [])

  return (
    <section className="mt-12">
      <h2 className="text-xs font-semibold text-[--color-text-muted] uppercase tracking-wider mb-4">留言板</h2>

      {canPost && (
        <div className="mb-6 bg-[--color-bg-surface] border border-[--color-border] rounded-[--radius-lg] p-4">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="留下你的留言…（最多 500 字）"
            maxLength={500}
            rows={3}
            className="w-full resize-none bg-transparent text-sm text-[--color-text-primary] placeholder:text-[--color-text-muted] outline-none"
          />
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-[--color-text-muted] font-mono">{text.length}/500</span>
            <button
              onClick={handleSubmit}
              disabled={submitting || !text.trim()}
              className="px-4 py-1.5 text-xs rounded-[--radius-sm] bg-[--color-accent] text-white disabled:opacity-40 hover:opacity-90 transition-opacity"
            >
              {submitting ? "提交中…" : "留言"}
            </button>
          </div>
        </div>
      )}

      {messages.length === 0 ? (
        <p className="text-sm text-[--color-text-muted]">还没有人留言{canPost ? "，来做第一个吧" : ""}</p>
      ) : (
        <div className="space-y-0 bg-[--color-bg-surface] border border-[--color-border] rounded-[--radius-lg] overflow-hidden">
          {messages.map((msg, i) => (
            <div
              key={msg.id}
              className={`flex items-start gap-3 px-4 py-3 ${i < messages.length - 1 ? "border-b border-[--color-border]" : ""}`}
            >
              <UserAvatar
                size="sm"
                name={msg.author.displayName}
                email={msg.author.email}
                avatarText={msg.author.avatarText}
                avatarUrl={msg.author.avatarUrl}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-medium text-[--color-text-primary]">
                    {msg.author.displayName || msg.author.email}
                  </span>
                  <span className="text-xs text-[--color-text-muted] font-mono">{formatRelative(msg.createdAt)}</span>
                </div>
                <p className="text-sm text-[--color-text-secondary] whitespace-pre-wrap break-words">{msg.content}</p>
              </div>
              {isOwner && (
                <button
                  onClick={() => handleDelete(msg.id)}
                  className="shrink-0 text-[--color-text-muted] hover:text-red-500 transition-colors"
                  title="删除留言"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
