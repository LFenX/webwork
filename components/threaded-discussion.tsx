"use client"

import { FormEvent, useMemo, useRef, useState } from "react"
import { ChevronDown, ChevronRight, Reply, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { StickerPicker, type StickerPick } from "@/components/sticker-picker"
import { UserAvatar } from "@/components/user-avatar"
import { getDict } from "@/lib/i18n"
import { handleEnterToSubmit } from "@/lib/keyboard"

export type ThreadAuthor = {
  id?: string
  displayName: string
  email: string
  avatarText?: string | null
  avatarUrl?: string | null
}

export type ThreadItem = {
  id: string
  content: string
  parentId?: string | null
  stickerId?: string | null
  stickerEmoji?: string | null
  sticker?: { id: string; url: string; name?: string; originalName?: string; isAnimated?: boolean } | null
  createdAt: string
  author: ThreadAuthor
}

export type ThreadNode = ThreadItem & { replies: ThreadNode[] }

function buildTree(items: ThreadItem[], newestFirst: boolean) {
  const nodes = new Map<string, ThreadNode>()
  const roots: ThreadNode[] = []

  items.forEach((item) => nodes.set(item.id, { ...item, replies: [] }))
  items.forEach((item) => {
    const node = nodes.get(item.id)
    if (!node) return

    const parent = item.parentId ? nodes.get(item.parentId) : null
    if (parent) parent.replies.push(node)
    else roots.push(node)
  })

  const byTime = (a: ThreadNode, b: ThreadNode) => {
    const diff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    return newestFirst ? -diff : diff
  }
  roots.sort(byTime)
  roots.forEach((root) => sortReplies(root, byTime))
  return roots
}

function sortReplies(node: ThreadNode, compareFn: (a: ThreadNode, b: ThreadNode) => number) {
  node.replies.sort(compareFn)
  node.replies.forEach((reply) => sortReplies(reply, compareFn))
}

type ThreadedDiscussionProps = {
  items: ThreadItem[]
  canReply?: boolean
  canDelete?: boolean | ((item: ThreadItem) => boolean)
  onReply: (parentId: string, content: string, sticker?: StickerPick | null) => Promise<void>
  onDelete?: (id: string) => void
  formatTime: (iso: string) => string
  newestFirst?: boolean
}

export function ThreadedDiscussion({
  items,
  canReply = true,
  canDelete,
  onReply,
  onDelete,
  formatTime,
  newestFirst = false,
}: ThreadedDiscussionProps) {
  const tree = useMemo(() => buildTree(items, newestFirst), [items, newestFirst])

  return (
    <div className="space-y-4">
      {tree.map((node) => (
        <ThreadNodeComponent
          key={node.id}
          node={node}
          canReply={canReply}
          canDelete={typeof canDelete === "function" ? canDelete(node) : (canDelete ?? Boolean(onDelete))}
          onReply={onReply}
          onDelete={onDelete}
          formatTime={formatTime}
          newestFirst={newestFirst}
        />
      ))}
    </div>
  )
}

function ThreadNodeComponent({
  node,
  canReply,
  canDelete,
  onReply,
  onDelete,
  formatTime,
  newestFirst,
}: {
  node: ThreadNode
  canReply: boolean
  canDelete: boolean
  onReply: (parentId: string, content: string, sticker?: StickerPick | null) => Promise<void>
  onDelete?: (id: string) => void
  formatTime: (iso: string) => string
  newestFirst: boolean
}) {
  const dict = getDict()
  const cm = dict.comments

  const [isExpanded, setIsExpanded] = useState(true)
  const [replyingTo, setReplyingTo] = useState<ThreadItem | null>(null)
  const [replyText, setReplyText] = useState("")
  const [replySticker, setReplySticker] = useState<StickerPick | null>(null)
  const [saving, setSaving] = useState(false)
  const replyFormRef = useRef<HTMLFormElement>(null)

  async function submitReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!replyText.trim() && !replySticker) return
    setSaving(true)
    try {
      const content = replyText.trim()
      await onReply(replyingTo!.id, content, replySticker)
      setReplyText("")
      setReplySticker(null)
      setReplyingTo(null)
    } finally {
      setSaving(false)
    }
  }

  const hasReplies = node.replies.length > 0
  const replyCount = node.replies.length

  return (
    <div className="rounded-[--radius-md] border border-[--color-border] bg-[--color-bg-surface] p-3">
      <div className="flex items-start gap-3">
        <UserAvatar
          size="sm"
          name={node.author.displayName || node.author.email}
          email={node.author.email}
          avatarText={node.author.avatarText}
          avatarUrl={node.author.avatarUrl}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{node.author.displayName || node.author.email}</span>
            <span className="text-xs text-[--color-text-muted]">{formatTime(node.createdAt)}</span>
          </div>
          {node.content && <p className="mt-1 whitespace-pre-wrap text-sm">{node.content}</p>}
          {node.sticker && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={node.sticker.url} alt={node.sticker.name || node.sticker.originalName || ""} className="mt-1 h-16 w-16 object-contain" />
          )}
          {node.stickerEmoji && <span className="mt-1 text-3xl">{node.stickerEmoji}</span>}

          <div className="mt-2 flex items-center gap-3 text-xs">
            {hasReplies && (
              <button
                type="button"
                onClick={() => setIsExpanded((v) => !v)}
                className="inline-flex items-center gap-1 text-[--color-text-muted] hover:text-[--color-text-primary]"
              >
                {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                {isExpanded ? cm.hideReplies(replyCount) : cm.showReplies(replyCount)}
              </button>
            )}
            {canReply && (
              <button
                type="button"
                onClick={() => {
                  setReplyingTo(node)
                  setReplyText("")
                  setReplySticker(null)
                }}
                className="inline-flex items-center gap-1 text-[--color-text-muted] hover:text-[--color-text-primary]"
              >
                <Reply size={13} />
                {cm.reply}
              </button>
            )}
            {canDelete && onDelete && (
              <button
                type="button"
                onClick={() => onDelete(node.id)}
                className="inline-flex items-center gap-1 text-[--color-text-muted] hover:text-[--color-danger]"
                title={cm.delete}
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
        </div>
      </div>

      {replyingTo && (
        <form ref={replyFormRef} onSubmit={submitReply} className="mt-4 rounded-[--radius-md] border border-[--color-border] bg-[--color-bg-hover] p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="truncate text-xs text-[--color-text-muted]">{cm.replyTo} {replyingTo.author.displayName || replyingTo.author.email}</p>
            <button
              type="button"
              onClick={() => {
                setReplyingTo(null)
                setReplyText("")
                setReplySticker(null)
              }}
              className="p-1 text-[--color-text-muted] hover:text-[--color-text-primary]"
            >
              <X size={14} />
            </button>
          </div>
          <textarea
            value={replyText}
            onChange={(event) => setReplyText(event.target.value)}
            onKeyDown={(event) => handleEnterToSubmit(event, () => replyFormRef.current?.requestSubmit(), { disabled: saving || (!replyText.trim() && !replySticker) })}
            rows={2}
            className="w-full rounded-[--radius-sm] border border-[--color-border] bg-[--color-bg-surface] p-2 text-sm outline-none focus:border-[--color-accent]"
            placeholder="Write a reply..."
          />
          {replySticker && (
            <div className="mt-2 inline-flex items-center gap-2 rounded border border-[--color-border] bg-[--color-bg-surface] px-2 py-1">
              {replySticker.type === "emoji" ? <span className="text-xl">{replySticker.emoji}</span> : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={replySticker.url} alt={replySticker.name} className="h-8 w-8 object-contain" />
              )}
              <button type="button" onClick={() => setReplySticker(null)} className="text-[--color-text-muted] hover:text-[--color-danger]">×</button>
            </div>
          )}
          <div className="mt-3 flex items-center gap-2">
            <Button type="submit" size="sm" disabled={saving || (!replyText.trim() && !replySticker)}>
              {saving ? cm.sendingReply : cm.sendReply}
            </Button>
            <StickerPicker compact onPick={setReplySticker} />
          </div>
        </form>
      )}

      {hasReplies && isExpanded && (
        <div className="ml-6 mt-3 space-y-3">
          {node.replies.map((reply) => (
            <ThreadNodeComponent
              key={reply.id}
              node={reply}
              canReply={canReply}
              canDelete={canDelete}
              onReply={onReply}
              onDelete={onDelete}
              formatTime={formatTime}
              newestFirst={newestFirst}
            />
          ))}
        </div>
      )}
    </div>
  )
}
