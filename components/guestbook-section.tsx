"use client"

import { useCallback, useRef, useState } from "react"
import { toast } from "sonner"
import { StickerPicker, type StickerPick } from "@/components/sticker-picker"
import { ThreadedDiscussion, type ThreadItem } from "@/components/threaded-discussion"

type Message = ThreadItem & {
  author: {
    id: string
    displayName: string
    email: string
    avatarText: string
    avatarUrl: string | null
  }
}

type Props = {
  ownerId: string
  initialMessages: Message[]
  isOwner: boolean
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

function removeWithChildren(items: Message[], id: string) {
  const removed = new Set([id])
  let changed = true
  while (changed) {
    changed = false
    items.forEach((item) => {
      if (item.parentId && removed.has(item.parentId) && !removed.has(item.id)) {
        removed.add(item.id)
        changed = true
      }
    })
  }
  return items.filter((item) => !removed.has(item.id))
}

function SelectedSticker({ sticker, onClear }: { sticker: StickerPick; onClear: () => void }) {
  return (
    <div className="inline-flex items-center gap-2 rounded border border-[--color-border] bg-[--color-bg-surface] px-2 py-1">
      {sticker.type === "emoji" ? <span className="text-2xl">{sticker.emoji}</span> : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={sticker.url} alt={sticker.name} className="h-10 w-10 object-contain" />
      )}
      <button type="button" onClick={onClear} className="text-[--color-text-muted] hover:text-[--color-danger]">×</button>
    </div>
  )
}

export function GuestbookSection({ ownerId, initialMessages, isOwner, canPost }: Props) {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [text, setText] = useState("")
  const [sticker, setSticker] = useState<StickerPick | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const submitMessage = useCallback(async (content: string, parentId?: string, nextSticker?: StickerPick | null) => {
    const res = await fetch("/api/guestbook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ownerId,
        content,
        parentId,
        stickerId: nextSticker?.type === "asset" ? nextSticker.id : null,
        stickerEmoji: nextSticker?.type === "emoji" ? nextSticker.emoji : null,
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      toast.error(data.error ?? "留言失败")
      throw new Error(data.error ?? "留言失败")
    }
    setMessages((prev) => [data as Message, ...prev])
  }, [ownerId])

  const handleSubmit = useCallback(async () => {
    const content = text.trim()
    if (!content && !sticker) return
    setSubmitting(true)
    try {
      await submitMessage(content, undefined, sticker)
      setText("")
      setSticker(null)
      textareaRef.current?.focus()
    } finally {
      setSubmitting(false)
    }
  }, [sticker, submitMessage, text])

  const handleDelete = useCallback(async (id: string) => {
    const res = await fetch(`/api/guestbook/${id}`, { method: "DELETE" })
    if (!res.ok) {
      toast.error("删除失败")
      return
    }
    setMessages((prev) => removeWithChildren(prev, id))
  }, [])

  return (
    <section className="mt-12">
      <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-[--color-text-muted]">留言板</h2>

      {canPost && (
        <div className="mb-6 rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface] p-4">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="留下你的留言...（最多 500 字）"
            maxLength={500}
            rows={3}
            className="w-full resize-none bg-transparent text-sm text-[--color-text-primary] outline-none placeholder:text-[--color-text-muted]"
          />
          {sticker && <SelectedSticker sticker={sticker} onClear={() => setSticker(null)} />}
          <div className="mt-2 flex items-center justify-between">
            <span className="font-mono text-xs text-[--color-text-muted]">{text.length}/500</span>
            <div className="flex items-center gap-2">
              <StickerPicker compact onPick={setSticker} />
              <button
                onClick={handleSubmit}
                disabled={submitting || (!text.trim() && !sticker)}
                className="rounded-[--radius-sm] border border-[#1A1A1A] bg-[#1A1A1A] px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#333333] disabled:border-[--color-border-strong] disabled:bg-[--color-bg-hover] disabled:text-[--color-text-muted]"
              >
                {submitting ? "提交中..." : "留言"}
              </button>
            </div>
          </div>
        </div>
      )}

      {messages.length === 0 ? (
        <p className="text-sm text-[--color-text-muted]">还没有人留言{canPost ? "，来做第一个吧" : ""}</p>
      ) : (
        <div className="overflow-hidden rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface] px-4">
          <ThreadedDiscussion
            items={messages}
            newestFirst
            canReply={canPost}
            canDelete={isOwner}
            maxLength={500}
            formatTime={formatRelative}
            onReply={(parentId, content, replySticker) => submitMessage(content, parentId, replySticker)}
            onDelete={handleDelete}
          />
        </div>
      )}
    </section>
  )
}
