"use client"

import { FormEvent, useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { StickerPicker, type StickerPick } from "@/components/sticker-picker"
import { ThreadedDiscussion, type ThreadItem } from "@/components/threaded-discussion"
import { getDict } from "@/lib/i18n"
import { handleEnterToSubmit } from "@/lib/keyboard"
import { formatChinaDateTime } from "@/lib/time"

interface CommentItem extends ThreadItem {
  author: { id: string; displayName: string; email: string; avatarText?: string | null; avatarUrl?: string | null }
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
    try {
      const res = await fetch(`/api/posts/comments/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed to delete comment")
      setComments((prev) => prev.filter((item) => item.id !== id))
      toast(cm.deleted)
    } catch {
      toast.error("删除失败")
    }
  }, [cm.deleted])

  const handleReply = useCallback(async (parentId: string, replyContent: string, replySticker?: StickerPick | null) => {
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
      toast.error("回复失败")
      throw new Error("回复失败")
    }
    const saved = await res.json()
    setComments((prev) => [...prev, saved])
  }, [postId])

  return (
    <section>
      <h2 className="mb-6 text-lg font-semibold text-[--color-text-primary]">{cm.title}</h2>

      <form ref={formRef} onSubmit={handleSubmit} className="mb-8 space-y-3">
        <textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          onKeyDown={(event) => handleEnterToSubmit(event, () => formRef.current?.requestSubmit(), { disabled: saving || (!content.trim() && !sticker) })}
          placeholder={cm.placeholder}
          rows={3}
          className="w-full rounded-[--radius-sm] border border-[--color-border] bg-[--color-bg-surface] p-3 text-sm outline-none focus:border-[--color-accent]"
        />
        <div className="flex items-center justify-end gap-2">
          <StickerPicker onPick={setSticker} />
          {sticker && (
            <div className="inline-flex items-center gap-2 rounded border border-[--color-border] bg-[--color-bg-surface] px-2 py-1">
              {sticker.type === "emoji" ? <span className="text-2xl">{sticker.emoji}</span> : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={sticker.url} alt={sticker.name} className="h-10 w-10 object-contain" />
              )}
              <button type="button" onClick={() => setSticker(null)} className="text-[--color-text-muted] hover:text-[--color-danger]">×</button>
            </div>
          )}
          <Button type="submit" disabled={saving || (!content.trim() && !sticker)} size="sm">
            {saving ? cm.sending : cm.post}
          </Button>
        </div>
      </form>

      {loading ? (
        <p className="text-sm text-[--color-text-muted]">{cm.loading}</p>
      ) : comments.length === 0 ? (
        <p className="text-sm text-[--color-text-muted]">{cm.noComments}</p>
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
    </section>
  )
}
