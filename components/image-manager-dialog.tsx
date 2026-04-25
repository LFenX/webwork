"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { ChevronLeft, ChevronRight, Copy, Download, ImageOff, Trash2, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { getDict } from "@/lib/i18n"

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
  const totalPages = Math.max(1, Math.ceil(total / 20))

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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetching on dialog open is the standard pattern
  }, [open, load])

  async function handleDelete(item: UploadItem) {
    if (!confirm(im.confirmDelete(item.originalName))) return
    try {
      const res = await fetch(`/api/uploads/${item.id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Delete failed")
      toast(im.deleted)
      load()
    } catch {
      toast.error(im.deleteFailed)
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
    await navigator.clipboard.writeText(md)
    toast(im.copiedMarkdown)
  }

  async function handleCopyLink(url: string) {
    await navigator.clipboard.writeText(url)
    toast(dict.common.copied)
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
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{im.title}</DialogTitle>
        </DialogHeader>

        <div className="mb-3 text-xs text-[--color-text-muted]">
          {im.used}: {usedMB} / {quotaMB} MB ({items.length} files)
        </div>

        {loading ? (
          <div className="py-8 text-center text-sm text-[--color-text-muted]">{im.loading}</div>
        ) : items.length === 0 ? (
          <div className="py-8 text-center text-sm text-[--color-text-muted]">
            <ImageOff size={32} className="mx-auto mb-2 text-[--color-border]" />
            {im.noImages}
          </div>
        ) : (
          <div className="max-h-[55vh] space-y-2 overflow-y-auto pr-1">
            {items.map((item) => (
              <div key={item.id} className="flex items-center gap-3 rounded-[--radius-md] border border-[--color-border] bg-[--color-bg-surface] p-3">
                {item.mimeType.startsWith("image/") ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.url} alt={item.originalName} className="h-12 w-12 rounded object-cover" />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded bg-[--color-bg-hover] text-xs font-mono">
                    {item.mimeType.split("/")[1]?.slice(0, 4).toUpperCase() ?? "FILE"}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{item.originalName}</p>
                  <p className="text-xs text-[--color-text-muted]">{formatBytes(item.size)}</p>
                </div>
                <div className="flex items-center gap-1">
                  {onInsert && (
                    <Button size="sm" variant="ghost" className="h-8 px-2 text-xs" onClick={() => handleInsert(item)} title={im.insertIntoEditor}>
                      <ChevronLeft size={14} />
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" className="h-8 px-2 text-xs" onClick={() => handleCopyMarkdown(item)} title={im.copyMarkdown}>
                    <Copy size={14} />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-8 px-2 text-xs" onClick={() => handleCopyLink(item.url)} title={im.copyLink}>
                    <X size={14} />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-8 px-2 text-xs" onClick={() => handleDownload(item.url, item.originalName)} title={im.download}>
                    <Download size={14} />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-8 px-2 text-xs text-[--color-danger]" onClick={() => handleDelete(item)} title={im.delete}>
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
            ))}
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
