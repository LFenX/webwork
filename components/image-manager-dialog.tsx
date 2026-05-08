"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ChevronLeft, ChevronRight, Copy, Download, ImageOff, Link as LinkIcon, Plus, Search, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { getDict } from "@/lib/i18n"
import { confirmAction, copyTextWithToast } from "@/lib/interaction-feedback"

interface UploadItem {
  id: string
  url: string
  originalName: string
  size: number
  mimeType: string
  createdAt: string
}

interface ImageManagerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onInsert?: (markdown: string) => void
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function ImageManagerDialog({ open, onOpenChange, onInsert }: ImageManagerDialogProps) {
  const dict = getDict()
  const im = dict.images

  const [items, setItems] = useState<UploadItem[]>([])
  const [total, setTotal] = useState(0)
  const [used, setUsed] = useState(0)
  const [quota, setQuota] = useState(1)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [sort, setSort] = useState<"newest" | "name" | "size">("newest")
  const totalPages = Math.max(1, Math.ceil(total / 20))

  const visibleItems = useMemo(() => {
    const filtered = query.trim()
      ? items.filter((item) => item.originalName.toLowerCase().includes(query.trim().toLowerCase()))
      : items
    const sorted = [...filtered].sort((a, b) => {
      if (sort === "name") return a.originalName.localeCompare(b.originalName)
      if (sort === "size") return b.size - a.size
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })
    return sorted
  }, [items, query, sort])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/uploads?page=${page}&limit=20`, { cache: "no-store" })
      const data = await res.json()
      setItems(Array.isArray(data.items) ? data.items : [])
      setTotal(data.total ?? 0)
      setUsed(data.used ?? 0)
      setQuota(data.quota ?? 1)
    } finally {
      setLoading(false)
    }
  }, [page])

  const prevOpen = useRef(open)

  useEffect(() => {
    if (open && !prevOpen.current) load()
    prevOpen.current = open
  }, [open, load])

  async function handleDelete(item: UploadItem) {
    if (!confirmAction(`${im.confirmDelete(item.originalName)}\n删除后已插入文章的图片链接可能失效。`)) return
    setDeletingId(item.id)
    try {
      const res = await fetch(`/api/uploads/${item.id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Delete failed")
      toast(im.deleted)
      load()
    } catch {
      toast.error(im.deleteFailed)
    } finally {
      setDeletingId(null)
    }
  }

  function handleInsert(item: UploadItem) {
    const isImage = item.mimeType.startsWith("image/")
    const md = isImage ? `![${item.originalName}](${item.url})` : `[${item.originalName}](${item.url})`
    onInsert?.(md)
    toast(im.copiedMarkdown)
  }

  async function handleCopyMarkdown(item: UploadItem) {
    const isImage = item.mimeType.startsWith("image/")
    const md = isImage ? `![${item.originalName}](${item.url})` : `[${item.originalName}](${item.url})`
    await copyTextWithToast(md, im.copiedMarkdown, "复制失败，请手动复制")
  }

  async function handleCopyLink(url: string) {
    await copyTextWithToast(url, dict.common.copied, "复制失败，请手动复制")
  }

  function handleDownload(url: string, name: string) {
    const a = document.createElement("a")
    a.href = url
    a.download = name
    a.click()
  }

  const usedMB = (used / 1024 / 1024).toFixed(1)
  const quotaMB = (quota / 1024 / 1024).toFixed(0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{im.title}</DialogTitle>
        </DialogHeader>

        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[180px]">
            <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[--color-text-muted]" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={im.title}
              className="h-9 w-full rounded-md border border-[--color-border] bg-[--color-bg-surface] pl-8 pr-2 text-sm outline-none focus:border-[--color-text-muted]"
            />
          </div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as typeof sort)}
            className="h-9 rounded-md border border-[--color-border] bg-[--color-bg-surface] px-2 text-sm outline-none"
          >
            <option value="newest">最新</option>
            <option value="name">名称</option>
            <option value="size">大小</option>
          </select>
          <span className="ml-auto text-xs text-[--color-text-muted]">
            {usedMB} / {quotaMB} MB · {items.length}
          </span>
        </div>

        {loading ? (
          <div className="py-8 text-center text-sm text-[--color-text-muted]">{im.loading}</div>
        ) : visibleItems.length === 0 ? (
          <div className="py-8 text-center text-sm text-[--color-text-muted]">
            <ImageOff size={32} className="mx-auto mb-2 text-[--color-border]" />
            {items.length === 0 ? im.noImages : "未找到匹配项"}
          </div>
        ) : (
          <div className="max-h-[58vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {visibleItems.map((item) => {
                const isImage = item.mimeType.startsWith("image/")
                const ext = (item.mimeType.split("/")[1] ?? "FILE").slice(0, 4).toUpperCase()
                return (
                  <article
                    key={item.id}
                    className="group relative flex flex-col overflow-hidden rounded-[--radius-md] border border-[--color-border] bg-[--color-bg-surface] transition-shadow hover:shadow-md"
                  >
                    <div className="relative aspect-[4/3] bg-[--color-bg-hover]">
                      {isImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.url} alt={item.originalName} className="h-full w-full object-cover" loading="lazy" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center font-mono text-sm text-[--color-text-muted]">{ext}</div>
                      )}
                      <div className="absolute inset-0 flex items-end justify-center bg-gradient-to-t from-black/55 via-black/0 to-transparent p-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                        <div className="flex w-full items-center justify-between gap-1">
                          {onInsert ? (
                            <button
                              type="button"
                              onClick={() => handleInsert(item)}
                              className="inline-flex h-7 items-center gap-1 rounded-md bg-white/95 px-2 text-xs font-medium text-[--color-text-primary] shadow"
                              title={im.insertIntoEditor}
                            >
                              <Plus size={12} /> 插入
                            </button>
                          ) : <span />}
                          <div className="flex items-center gap-0.5">
                            <button type="button" onClick={() => handleCopyMarkdown(item)} className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-white/90 text-[--color-text-primary] shadow" title={im.copyMarkdown}>
                              <Copy size={12} />
                            </button>
                            <button type="button" onClick={() => handleCopyLink(item.url)} className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-white/90 text-[--color-text-primary] shadow" title={im.copyLink}>
                              <LinkIcon size={12} />
                            </button>
                            <button type="button" onClick={() => handleDownload(item.url, item.originalName)} className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-white/90 text-[--color-text-primary] shadow" title={im.download}>
                              <Download size={12} />
                            </button>
                            <button type="button" onClick={() => handleDelete(item)} disabled={deletingId === item.id} className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-white/90 text-[--color-danger] shadow disabled:opacity-50" title={im.delete}>
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col gap-0.5 px-2.5 py-2">
                      <p className="truncate text-xs font-medium text-[--color-text-primary]" title={item.originalName}>{item.originalName}</p>
                      <p className="text-[11px] text-[--color-text-muted]">{formatBytes(item.size)}</p>
                    </div>
                  </article>
                )
              })}
            </div>
          </div>
        )}

        {totalPages > 1 && (
          <div className="mt-3 flex items-center justify-center gap-3">
            <Button size="sm" variant="outline" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
              <ChevronLeft size={14} />
            </Button>
            <span className="text-xs text-[--color-text-muted]">{page} / {totalPages}</span>
            <Button size="sm" variant="outline" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
              <ChevronRight size={14} />
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
