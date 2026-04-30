"use client"

import { useCallback, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { StickerPicker, type StickerPick } from "@/components/sticker-picker"
import { ThreadedDiscussion, type ThreadItem } from "@/components/threaded-discussion"
import { getDict } from "@/lib/i18n"
import { handleEnterToSubmit } from "@/lib/keyboard"
import { confirmAction } from "@/lib/interaction-feedback"

type Message = ThreadItem & {
  author: {
    id: string
    displayName: string
    email: string
    avatarText: string
    avatarUrl: string | null
    location?: string | null
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
    <div className="inline-flex items-center gap-2 rounded-full bg-[--color-bg-surface] px-2.5 py-1.5 shadow-[inset_0_0_0_1px_var(--color-border)]">
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
    if (!confirmAction("确定要删除这条留言吗？删除后无法恢复。")) return
    const res = await fetch(`/api/guestbook/${id}`, { method: "DELETE" })
    if (!res.ok) {
      toast.error("删除失败")
      return
    }
    setMessages((prev) => prev.filter((item) => item.id !== id))
    toast.success("留言已删除")
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
      <div className="mb-5 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-[--color-text-primary]">{gb.title}</h2>
          <p className="mt-1 text-sm text-[--color-text-muted]">把想法、祝福或一张表情留在这里。</p>
        </div>
        {messages.length > 0 ? <span className="rounded-full bg-[--color-brand-soft] px-3 py-1 text-xs font-medium text-[--color-brand]">{messages.length} 条</span> : null}
      </div>

      <div className="rounded-[--radius-xl] border border-white/60 bg-[--color-bg-surface]/35 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_18px_48px_rgba(15,23,42,0.055)] backdrop-blur-md">
        {canPost && (
          <div className="mb-5 rounded-[--radius-lg] bg-[--color-bg-surface]/45 p-3 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.08)]">
            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              onKeyDown={(event) => handleEnterToSubmit(event, handleSubmit, { disabled: sending || (!content.trim() && !sticker) })}
              placeholder={gb.placeholder}
              rows={2}
              className="min-h-[70px] w-full resize-none rounded-[--radius-md] border border-[--color-border] bg-[--color-bg-primary]/45 p-3 text-sm leading-6 outline-none transition-shadow placeholder:text-[--color-text-muted] focus:border-[--color-brand-border] focus:ring-2 focus:ring-[--color-brand]/20"
            />
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <StickerPicker onPick={setSticker} />
                {sticker && <SelectedStickerView sticker={sticker} onClear={() => setSticker(null)} />}
              </div>
              <Button
                type="button"
                size="sm"
                onClick={handleSubmit}
                disabled={sending || (!content.trim() && !sticker)}
                loading={sending}
                loadingText={gb.sending}
              >
                {gb.submit}
              </Button>
            </div>
          </div>
        )}

        {messages.length === 0 ? (
          <div className="rounded-[--radius-lg] bg-[--color-bg-surface]/45 px-5 py-8 text-center text-sm text-[--color-text-muted] shadow-[inset_0_0_0_1px_rgba(15,23,42,0.06)]">{gb.noMessages}</div>
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
      </div>
    </section>
  )
}
