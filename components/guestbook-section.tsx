"use client"

import { useCallback, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/empty-state"
import { SectionCard } from "@/components/profile/section-card"
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
    <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-2.5 py-1.5 shadow-sm">
      {s.type === "emoji" ? <span className="text-2xl">{s.emoji}</span> : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={s.url} alt={s.name} className="h-10 w-10 object-contain" />
      )}
      <button type="button" onClick={onClear} className="text-slate-400 hover:text-rose-500">×</button>
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
    <SectionCard
      title={gb.title}
      description="欢迎留下建议、问题，或者随便打个招呼。"
      action={messages.length > 0 ? <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-600">{messages.length} 条</span> : null}
      contentClassName="p-4 sm:p-5"
    >
      <div className="flex flex-col gap-5">
        {canPost && (
          <div className="rounded-[16px] border border-slate-200 bg-slate-50/70 p-3">
            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              onKeyDown={(event) => handleEnterToSubmit(event, handleSubmit, { disabled: sending || (!content.trim() && !sticker) })}
              placeholder={gb.placeholder}
              rows={2}
              className="min-h-[76px] w-full resize-none rounded-[14px] border border-slate-200 bg-white p-3 text-sm leading-6 text-slate-800 outline-none transition-shadow placeholder:text-slate-400 focus:border-blue-300 focus:ring-2 focus:ring-blue-500/15"
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
          <EmptyState title={gb.noMessages} description="这里会展示好友和主页主人的互动。" compact className="border-slate-200 bg-slate-50/70" />
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
    </SectionCard>
  )
}
