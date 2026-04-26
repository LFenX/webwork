"use client"

import { useCallback, useState } from "react"
import { toast } from "sonner"
import { StickerPicker, type StickerPick } from "@/components/sticker-picker"
import { ThreadedDiscussion, type ThreadItem } from "@/components/threaded-discussion"
import { getDict } from "@/lib/i18n"
import { handleEnterToSubmit } from "@/lib/keyboard"

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

function SelectedStickerView({ sticker: s, onClear }: { sticker: StickerPick; onClear: () => void }) {
  return (
    <div className="inline-flex items-center gap-2 rounded border border-[--color-border] bg-[--color-bg-surface] px-2 py-1">
      {s.type === "emoji" ? <span className="text-2xl">{s.emoji}</span> : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={s.url} alt={s.name} className="h-10 w-10 object-contain" />
      )}
      <button type="button" onClick={onClear} className="text-[--color-text-muted] hover:text-[--color-danger]">×</button>
    </div>
  )
}

export function GuestbookSection({ ownerId, initialMessages, isOwner, canPost }: Props) {
  const dict = getDict()
  const gb = dict.guestbook

  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [content, setContent] = useState("")
  const [sticker, setSticker] = useState<StickerPick | null>(null)
  const [sending, setSending] = useState(false)

  const handleSubmit = useCallback(async () => {
    if (!content.trim() && !sticker) return
    setSending(true)
    try {
      const res = await fetch("/api/guestbook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ownerId,
          content: content.trim(),
          stickerId: sticker?.type === "asset" ? sticker.id : null,
          stickerEmoji: sticker?.type === "emoji" ? sticker.emoji : null,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error ?? "留言失败")
        return
      }
      setMessages((prev) => [data as Message, ...prev])
      setContent("")
      setSticker(null)
    } finally {
      setSending(false)
    }
  }, [content, sticker, ownerId])

  const handleReply = useCallback(async (parentId: string, replyContent: string, replySticker?: StickerPick | null) => {
    const res = await fetch("/api/guestbook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ownerId,
        content: replyContent.trim(),
        parentId,
        stickerId: replySticker?.type === "asset" ? replySticker.id : null,
        stickerEmoji: replySticker?.type === "emoji" ? replySticker.emoji : null,
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      toast.error(data.error ?? "回复失败")
      throw new Error(data.error ?? "回复失败")
    }
    setMessages((prev) => [...prev, data as Message])
  }, [ownerId])

  const handleDelete = useCallback(async (id: string) => {
    const res = await fetch(`/api/guestbook/${id}`, { method: "DELETE" })
    if (!res.ok) {
      toast.error("删除失败")
      return
    }
    setMessages((prev) => prev.filter((item) => item.id !== id))
  }, [])

  function formatRelative(iso: string) {
    const diff = Date.now() - new Date(iso).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return gb.justNow
    if (mins < 60) return gb.minutesAgo(mins)
    const hours = Math.floor(mins / 60)
    if (hours < 24) return gb.hoursAgo(hours)
    const days = Math.floor(hours / 24)
    if (days < 30) return gb.daysAgo(days)
    return new Date(iso).toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" })
  }

  return (
    <section>
      <h2 className="mb-6 text-lg font-semibold text-[--color-text-primary]">{gb.title}</h2>

      {canPost && (
        <div className="mb-8 space-y-3">
          <textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            onKeyDown={(event) => handleEnterToSubmit(event, handleSubmit, { disabled: sending || (!content.trim() && !sticker) })}
            placeholder={gb.placeholder}
            rows={3}
            className="w-full rounded-[--radius-sm] border border-[--color-border] bg-[--color-bg-surface] p-3 text-sm outline-none focus:border-[--color-accent]"
          />
          <div className="flex items-center justify-end gap-2">
            <StickerPicker onPick={setSticker} />
            {sticker && <SelectedStickerView sticker={sticker} onClear={() => setSticker(null)} />}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={sending || (!content.trim() && !sticker)}
              className="inline-flex items-center gap-1.5 rounded-[--radius-sm] bg-[#1A1A1A] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#333] disabled:opacity-50"
            >
              {sending ? gb.sending : gb.submit}
            </button>
          </div>
        </div>
      )}

      {messages.length === 0 ? (
        <p className="text-sm text-[--color-text-muted]">{gb.noMessages}</p>
      ) : (
        <ThreadedDiscussion
          items={messages}
          canReply={canPost}
          canDelete={isOwner}
          onReply={handleReply}
          onDelete={handleDelete}
          formatTime={formatRelative}
          newestFirst
        />
      )}
    </section>
  )
}
