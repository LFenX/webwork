"use client"

import { FormEvent, useMemo, useState } from "react"
import { ChevronDown, ChevronRight, Reply, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { StickerPicker, type StickerPick } from "@/components/sticker-picker"
import { UserAvatar } from "@/components/user-avatar"

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

  const sorter = (a: ThreadNode, b: ThreadNode) => {
    const diff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    return newestFirst ? -diff : diff
  }

  const sortRecursive = (rows: ThreadNode[]) => {
    rows.sort(sorter)
    rows.forEach((node) => sortRecursive(node.replies))
  }

  sortRecursive(roots)
  return roots
}

function StickerPreview({ item }: { item: ThreadItem }) {
  if (item.stickerEmoji) return <p className="mt-2 text-4xl leading-none">{item.stickerEmoji}</p>
  if (!item.sticker) return null

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={item.sticker.url} alt={item.sticker.name || item.sticker.originalName || "sticker"} className="mt-2 max-h-28 max-w-28 object-contain" />
  )
}

export function ThreadedDiscussion({
  items,
  newestFirst = false,
  canReply,
  canDelete,
  maxLength,
  formatTime,
  onReply,
  onDelete,
}: {
  items: ThreadItem[]
  newestFirst?: boolean
  canReply: boolean
  canDelete?: boolean
  maxLength: number
  formatTime: (value: string) => string
  onReply: (parentId: string, content: string, sticker?: StickerPick | null) => Promise<void>
  onDelete?: (id: string) => void
}) {
  const roots = useMemo(() => buildTree(items, newestFirst), [items, newestFirst])
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [replyingTo, setReplyingTo] = useState<ThreadItem | null>(null)
  const [replyText, setReplyText] = useState("")
  const [replySticker, setReplySticker] = useState<StickerPick | null>(null)
  const [saving, setSaving] = useState(false)

  async function submitReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const content = replyText.trim()
    if (!replyingTo || (!content && !replySticker)) return

    setSaving(true)
    try {
      await onReply(replyingTo.id, content, replySticker)
      setExpanded((current) => ({ ...current, [replyingTo.id]: true }))
      setReplyText("")
      setReplySticker(null)
      setReplyingTo(null)
    } finally {
      setSaving(false)
    }
  }

  const renderNode = (node: ThreadNode, depth: number) => {
    const hasReplies = node.replies.length > 0
    const isExpanded = Boolean(expanded[node.id])
    const displayName = node.author.displayName || node.author.email

    return (
      <div key={node.id} className={depth === 0 ? "border-b border-[--color-border] py-3 last:border-b-0" : "border-l border-[--color-border] py-3 pl-3"}>
        <div className="flex min-w-0 items-start gap-3">
          <UserAvatar size="sm" name={node.author.displayName} email={node.author.email} avatarText={node.author.avatarText} avatarUrl={node.author.avatarUrl} />
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[--color-text-muted]">
              <span className="font-medium text-[--color-text-primary]">{displayName}</span>
              <span className="font-mono">{formatTime(node.createdAt)}</span>
            </div>

            {node.content && <p className="whitespace-pre-wrap break-words text-sm text-[--color-text-secondary]">{node.content}</p>}
            <StickerPreview item={node} />

            <div className="mt-2 flex flex-wrap items-center gap-3">
              {hasReplies ? (
                <button
                  type="button"
                  onClick={() => setExpanded((current) => ({ ...current, [node.id]: !isExpanded }))}
                  className="inline-flex items-center gap-1 text-xs text-[--color-link] hover:text-[--color-accent]"
                >
                  {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                  {isExpanded ? "Hide replies" : `Show ${node.replies.length} replies`}
                </button>
              ) : null}

              {canReply ? (
                <button
                  type="button"
                  onClick={() => {
                    setReplyingTo(node)
                    setReplyText("")
                    setReplySticker(null)
                  }}
                  className="inline-flex items-center gap-1 text-xs text-[--color-text-muted] hover:text-[--color-link]"
                >
                  <Reply size={13} />
                  Reply
                </button>
              ) : null}
            </div>
          </div>

          {canDelete && onDelete ? (
            <button
              type="button"
              onClick={() => onDelete(node.id)}
              className="mt-1 shrink-0 self-start rounded p-1 text-[--color-text-muted] hover:text-[--color-danger]"
              title="Delete"
            >
              <Trash2 size={14} />
            </button>
          ) : null}
        </div>

        {hasReplies && isExpanded ? <div className="ml-8 mt-1 space-y-1">{node.replies.map((reply) => renderNode(reply, depth + 1))}</div> : null}
      </div>
    )
  }

  return (
    <>
      <div className="divide-y-0">{roots.map((node) => renderNode(node, 0))}</div>

      {replyingTo ? (
        <form onSubmit={submitReply} className="mt-4 rounded-[--radius-md] border border-[--color-border] bg-[--color-bg-hover] p-3">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="truncate text-xs text-[--color-text-muted]">Reply to {replyingTo.author.displayName || replyingTo.author.email}</p>
            <button
              type="button"
              onClick={() => {
                setReplyingTo(null)
                setReplyText("")
                setReplySticker(null)
              }}
              className="text-[--color-text-muted] hover:text-[--color-text-primary]"
            >
              <X size={14} />
            </button>
          </div>

          <textarea
            value={replyText}
            onChange={(event) => setReplyText(event.target.value)}
            maxLength={maxLength}
            rows={2}
            className="w-full resize-none rounded-[--radius-sm] border border-[--color-border] bg-[--color-bg-surface] px-3 py-2 text-sm outline-none focus:border-[--color-accent]"
          />

          {replySticker ? (
            <div className="mt-2 inline-flex items-center gap-2 rounded border border-[--color-border] bg-[--color-bg-surface] px-2 py-1">
              {replySticker.type === "emoji" ? (
                <span className="text-2xl">{replySticker.emoji}</span>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={replySticker.url} alt={replySticker.name} className="h-10 w-10 object-contain" />
              )}
              <button type="button" onClick={() => setReplySticker(null)} className="text-[--color-text-muted] hover:text-[--color-danger]">
                <X size={13} />
              </button>
            </div>
          ) : null}

          <div className="mt-2 flex items-center justify-between">
            <span className="font-mono text-xs text-[--color-text-muted]">{replyText.length}/{maxLength}</span>
            <div className="flex items-center gap-2">
              <StickerPicker compact onPick={setReplySticker} />
              <Button type="submit" size="sm" disabled={saving || (!replyText.trim() && !replySticker)} className="h-8">
                {saving ? "Sending..." : "Send reply"}
              </Button>
            </div>
          </div>
        </form>
      ) : null}
    </>
  )
}
