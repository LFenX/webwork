"use client"

import { FormEvent, useEffect, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { StickerPicker, type StickerPick } from "@/components/sticker-picker"
import { ThreadedDiscussion, type ThreadItem } from "@/components/threaded-discussion"
import { formatChinaDateTime } from "@/lib/time"

interface CommentItem extends ThreadItem {
  author: { id: string; displayName: string; email: string; avatarText?: string | null; avatarUrl?: string | null }
}

function removeWithChildren(items: CommentItem[], id: string) {
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

export function CommentsSection({ postId }: { postId: string }) {
  const [comments, setComments] = useState<CommentItem[]>([])
  const [content, setContent] = useState("")
  const [sticker, setSticker] = useState<StickerPick | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

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

  async function submitComment(nextContent: string, parentId?: string, nextSticker?: StickerPick | null) {
    const res = await fetch(`/api/posts/${postId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: nextContent,
        parentId,
        stickerId: nextSticker?.type === "asset" ? nextSticker.id : null,
        stickerEmoji: nextSticker?.type === "emoji" ? nextSticker.emoji : null,
      }),
      cache: "no-store",
    }).catch(() => null)
    if (!res?.ok) {
      const data = await res?.json().catch(() => null)
      toast.error(data?.error ?? "评论失败")
      throw new Error(data?.error ?? "评论失败")
    }
    const comment = await res.json()
    setComments((items) => [...items, comment])
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextContent = content.trim()
    if (!nextContent && !sticker) return
    setSaving(true)
    try {
      await submitComment(nextContent, undefined, sticker)
      setContent("")
      setSticker(null)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/posts/comments/${id}`, { method: "DELETE", cache: "no-store" })
    if (!res.ok) {
      toast.error("删除失败")
      return
    }
    setComments((items) => removeWithChildren(items, id))
  }

  return (
    <section className="mt-12 border-t border-[--color-border] pt-8">
      <h2 className="mb-4 text-base font-semibold">评论</h2>
      {loading ? (
        <p className="text-sm text-[--color-text-muted]">加载评论中...</p>
      ) : comments.length === 0 ? (
        <p className="mb-4 text-sm text-[--color-text-muted]">还没有评论。</p>
      ) : (
        <div className="mb-6 rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface] px-4">
          <ThreadedDiscussion
            items={comments}
            canReply
            canDelete
            maxLength={1000}
            formatTime={formatChinaDateTime}
            onReply={(parentId, replyContent, replySticker) => submitComment(replyContent, parentId, replySticker)}
            onDelete={handleDelete}
          />
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          rows={3}
          maxLength={1000}
          placeholder="写下评论..."
          className="w-full rounded-[--radius-sm] border border-[--color-border] bg-[--color-bg-surface] px-3 py-2 text-sm outline-none focus:border-[--color-text-primary]"
        />
        {sticker && <SelectedSticker sticker={sticker} onClear={() => setSticker(null)} />}
        <div className="flex items-center justify-between">
          <span className="font-mono text-xs text-[--color-text-muted]">{content.length}/1000</span>
          <div className="flex items-center gap-2">
            <StickerPicker compact onPick={setSticker} />
            <Button type="submit" size="sm" disabled={saving || (!content.trim() && !sticker)}>
              {saving ? "发送中..." : "发表评论"}
            </Button>
          </div>
        </div>
      </form>
    </section>
  )
}
