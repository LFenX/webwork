"use client"

import { FormEvent, useEffect, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { UserAvatar } from "@/components/user-avatar"
import { formatChinaDateTime } from "@/lib/time"

interface CommentItem {
  id: string
  content: string
  createdAt: string
  author: { displayName: string; email: string; avatarText?: string | null; avatarUrl?: string | null }
}

export function CommentsSection({ postId }: { postId: string }) {
  const [comments, setComments] = useState<CommentItem[]>([])
  const [content, setContent] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let active = true

    fetch(`/api/posts/${postId}/comments`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (!active) return
        setComments(Array.isArray(data) ? data : [])
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
    if (!content.trim()) return
    setSaving(true)

    const res = await fetch(`/api/posts/${postId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
      cache: "no-store",
    }).catch(() => null)

    if (!res?.ok) {
      const data = await res?.json().catch(() => null)
      toast.error(data?.error ?? "评论失败")
    } else {
      const comment = await res.json()
      setComments((items) => [...items, comment])
      setContent("")
    }

    setSaving(false)
  }

  return (
    <section className="mt-12 border-t border-[--color-border] pt-8">
      <h2 className="text-base font-semibold mb-4">评论</h2>
      {loading ? (
        <p className="text-sm text-[--color-text-muted]">加载评论中...</p>
      ) : comments.length === 0 ? (
        <p className="text-sm text-[--color-text-muted] mb-4">还没有评论。</p>
      ) : (
        <div className="space-y-4 mb-6">
          {comments.map((comment) => (
            <div key={comment.id} className="flex gap-3 border-b border-[--color-border] pb-3">
              <UserAvatar
                size="sm"
                name={comment.author.displayName}
                email={comment.author.email}
                avatarText={comment.author.avatarText}
                avatarUrl={comment.author.avatarUrl}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3 text-xs text-[--color-text-muted] mb-1">
                  <span className="font-medium text-[--color-text-secondary]">{comment.author.displayName || comment.author.email}</span>
                  <span>{formatChinaDateTime(comment.createdAt)}</span>
                </div>
                <p className="text-sm whitespace-pre-wrap">{comment.content}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          rows={3}
          placeholder="写下评论..."
          className="w-full rounded-[--radius-sm] border border-[--color-border] bg-[--color-bg-surface] px-3 py-2 text-sm outline-none focus:border-[--color-text-primary]"
        />
        <Button type="submit" size="sm" disabled={saving || !content.trim()}>
          {saving ? "发送中..." : "发表评论"}
        </Button>
      </form>
    </section>
  )
}
