"use client"

import { useCallback, useRef, useState } from "react"
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

  async function handleSubmit() {
    if (!content.trim() && !sticker) return
    setSending(true)
    try {
      const res = await fetch(`/api/guestbook/${ownerId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: content.trim(),
          stickerId: sticker?.type === "asset" ? sticker.id : null,
          stickerEmoji: sticker?.type === "emoji" ? sticker.emoji : null,
        }),
      })
      if (!res.ok) throw new Error("Failed to send message")
      const saved = await res.json()
      setMessages((prev) => [...prev, saved])
      setContent("")
      setSticker(null)
    } catch {
      toast.error("Failed to send message")
    } finally {
      setSending(false)
    }
  }

  async function handleReply(parentId: string, replyContent: string, replySticker?: StickerPick | null) {
    try {
      const res = await fetch(`/api/guestbook/${ownerId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: replyContent.trim(),
          parentId,
          stickerId: replySticker?.type === "asset" ? replySticker.id : null,
          stickerEmoji: replySticker?.type === "emoji" ? replySticker.emoji : null,
        }),
      })
      if (!res.ok) throw new Error("Failed to post reply")
      const saved = await res.json()
      setMessages((prev) => [...prev, saved])
    } catch {
      toast.error("Failed to post reply")
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/guestbook/${ownerId}/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed to delete message")
      setMessages((prev) => prev.filter((item) => item.id !== id))
      toast("Message deleted")
    } catch {
      toast.error("Failed to delete message")
    }
  }

  const canDelete = useCallback(
    (item: ThreadItem) => isOwner || item.author.id === ownerId,
    [isOwner, ownerId]
  )

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
            onKeyDown={(event) => handleEnterToSubmit(event, () => void handleSubmit(), { disabled: sending || (!content.trim() && !sticker) })}
            placeholder={gb.placeholder}
            rows={3}
            className="w-full rounded-[--radius-sm] border border-[--color-border] bg-[--color-bg-surface] p-3 text-sm outline-none focus:border-[--color-accent]"
          />
          <div className="flex items-center gap-2">
            <StickerPicker onPick={setSticker} />
          </div>
          {sticker && <SelectedStickerView sticker={sticker} onClear={() => setSticker(null)} />}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={sending || (!content.trim() && !sticker)}
            className="inline-flex items-center gap-1.5 rounded-[--radius-sm] bg-[--color-text-primary] px-4 py-2 text-sm text-[--color-bg-surface] hover:opacity-90 disabled:opacity-50"
          >
            {sending ? gb.sending : gb.submit}
          </button>
        </div>
      )}

      {messages.length === 0 ? (
        <p className="text-sm text-[--color-text-muted]">{gb.noMessages}</p>
      ) : (
        <ThreadedDiscussion
          items={messages}
          canReply={canPost}
          canDelete={canDelete}
          onReply={handleReply}
          onDelete={handleDelete}
          formatTime={formatRelative}
          newestFirst
        />
      )}
    </section>
  )
}
