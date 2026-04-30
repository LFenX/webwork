"use client"

import { FormEvent, useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { StickerPicker, type StickerPick } from "@/components/sticker-picker"
import { ThreadedDiscussion, type ThreadItem } from "@/components/threaded-discussion"
import { getDict } from "@/lib/i18n"
import { handleEnterToSubmit } from "@/lib/keyboard"
import { formatChinaDateTime } from "@/lib/time"
import { confirmAction } from "@/lib/interaction-feedback"

interface CommentItem extends ThreadItem {
  author: { id: string; displayName: string; email: string; avatarText?: string | null; avatarUrl?: string | null; location?: string | null }
}

export function CommentsSection({ postId }: { postId: string }) {
  const dict = getDict()
  const cm = dict.comments

  const [comments, setComments] = useState<CommentItem[]>([])
  const [content, setContent] = useState("")
  const [sticker, setSticker] = useState<StickerPick | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    let active = true
    fetch(`/api/posts/${postId}/comments`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (active) setComments(Array.isArray(data) ? data : [])
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [postId])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!content.trim() && !sticker) return
    setSaving(true)
    try {
      const res = await fetch(`/api/posts/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: content.trim(),
          stickerId: sticker?.type === "asset" ? sticker.id : null,
          stickerEmoji: sticker?.type === "emoji" ? sticker.emoji : null,
        }),
      })
      if (!res.ok) throw new Error("Failed to post comment")
      const saved = await res.json()
      setComments((prev) => [...prev, saved])
      setContent("")
      setSticker(null)
    } catch {
      toast.error("评论失败")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = useCallback(async (id: string) => {
    if (!confirmAction("确定要删除这条评论吗？删除后无法恢复。")) return
    try {
      const res = await fetch(`/api/posts/comments/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed to delete comment")
      setComments((prev) => prev.filter((item) => item.id !== id))
      toast.success(cm.deleted)
    } catch {
      toast.error("删除失败")
    }
  }, [cm.deleted])

  const handleReply = useCallback(async (parentId: string, replyContent: string, replySticker?: StickerPick | null) => {
    try {
      const res = await fetch(`/api/posts/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: replyContent.trim(),
          parentId,
          stickerId: replySticker?.type === "asset" ? replySticker.id : null,
          stickerEmoji: replySticker?.type === "emoji" ? replySticker.emoji : null,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? "回复失败")
      }
      const saved = await res.json()
      setComments((prev) => [...prev, saved])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "回复失败")
      throw error
    }
  }, [postId])

  return (
    <section>
      <div className="mb-5 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-[--color-text-primary]">{cm.title}</h2>
          <p className="mt-1 text-sm text-[--color-text-muted]">留下你的想法，或接着聊下去。</p>
        </div>
        {!loading && comments.length > 0 ? <span className="rounded-full bg-[--color-brand-soft] px-3 py-1 text-xs font-medium text-[--color-brand]">{comments.length} 条</span> : null}
      </div>

      <div className="rounded-[--radius-xl] border border-white/60 bg-[--color-bg-surface]/35 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_18px_48px_rgba(15,23,42,0.055)] backdrop-blur-md">
        <form ref={formRef} onSubmit={handleSubmit} className="mb-5 rounded-[--radius-lg] bg-[--color-bg-surface]/45 p-3 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.08)]">
          <textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            onKeyDown={(event) => handleEnterToSubmit(event, () => formRef.current?.requestSubmit(), { disabled: saving || (!content.trim() && !sticker) })}
            placeholder={cm.placeholder}
            rows={2}
            className="min-h-[70px] w-full resize-none rounded-[--radius-md] border border-[--color-border] bg-[--color-bg-primary]/45 p-3 text-sm leading-6 outline-none transition-shadow placeholder:text-[--color-text-muted] focus:border-[--color-brand-border] focus:ring-2 focus:ring-[--color-brand]/20"
          />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <StickerPicker onPick={setSticker} />
              {sticker && (
                <div className="inline-flex items-center gap-2 rounded-full bg-[--color-bg-surface] px-2.5 py-1.5 shadow-[inset_0_0_0_1px_var(--color-border)]">
                  {sticker.type === "emoji" ? <span className="text-2xl">{sticker.emoji}</span> : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={sticker.url} alt={sticker.name} className="h-10 w-10 object-contain" />
                  )}
                  <button type="button" onClick={() => setSticker(null)} className="text-[--color-text-muted] hover:text-[--color-danger]">×</button>
                </div>
              )}
            </div>
            <Button type="submit" disabled={saving || (!content.trim() && !sticker)} size="sm" className="bg-[--color-brand] text-white opacity-100 shadow-none disabled:bg-[#8FB1F8] disabled:text-white disabled:opacity-100">
              {saving ? cm.sending : cm.post}
            </Button>
          </div>
        </form>

        {loading ? (
          <div className="rounded-[--radius-lg] bg-[--color-bg-surface]/45 px-5 py-8 text-center text-sm text-[--color-text-muted] shadow-[inset_0_0_0_1px_rgba(15,23,42,0.06)]">{cm.loading}</div>
        ) : comments.length === 0 ? (
          <div className="rounded-[--radius-lg] bg-[--color-bg-surface]/45 px-5 py-8 text-center text-sm text-[--color-text-muted] shadow-[inset_0_0_0_1px_rgba(15,23,42,0.06)]">{cm.noComments}</div>
        ) : (
          <ThreadedDiscussion
            items={comments}
            canReply
            canDelete
            onReply={handleReply}
            onDelete={handleDelete}
            formatTime={formatChinaDateTime}
            newestFirst
          />
        )}
      </div>
    </section>
  )
}
