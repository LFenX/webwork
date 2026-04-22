"use client"

import { useCallback, useEffect, useState } from "react"
import { ChevronLeft, ChevronRight, Copy, Download, ImageOff, Trash2, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

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
  const [items, setItems] = useState<UploadItem[]>([])
  const [total, setTotal] = useState(0)
  const [used, setUsed] = useState(0)
  const [quota, setQuota] = useState(1)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [lightbox, setLightbox] = useState<number | null>(null)

  const size = 20
  const totalPages = Math.ceil(total / size)

  const fetchItems = useCallback(async (p: number) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/uploads?page=${p}&size=${size}`, { cache: "no-store" })
      if (!res.ok) return
      const data = await res.json()
      setItems(data.items)
      setTotal(data.total)
      setUsed(data.used)
      setQuota(data.quota)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    const timeout = window.setTimeout(() => {
      void fetchItems(page)
    }, 0)
    return () => window.clearTimeout(timeout)
  }, [open, page, fetchItems])

  async function handleDelete(id: string) {
    if (!confirm("确认删除这张图片？已引用的图片链接将失效。")) return
    const res = await fetch(`/api/uploads/${id}`, { method: "DELETE" })
    if (!res.ok) { toast.error("删除失败"); return }
    toast.success("已删除")
    setItems((prev) => prev.filter((i) => i.id !== id))
    setTotal((t) => t - 1)
  }

  function handleCopyMarkdown(item: UploadItem) {
    const md = `![${item.originalName}](${item.url})`
    navigator.clipboard.writeText(md).then(() => toast.success("已复制 Markdown")).catch(() => toast.error("复制失败"))
  }

  function handleCopyUrl(item: UploadItem) {
    navigator.clipboard.writeText(item.url).then(() => toast.success("已复制链接")).catch(() => toast.error("复制失败"))
  }

  function handleInsert(item: UploadItem) {
    onInsert?.(`![${item.originalName}](${item.url})`)
    onOpenChange(false)
    toast.success("已插入图片")
  }

  const usedPct = Math.min(100, (used / quota) * 100)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-[--color-border] shrink-0">
          <DialogTitle className="text-base">图片库</DialogTitle>
          <div className="mt-2 space-y-1">
            <div className="flex items-center justify-between text-xs text-[--color-text-muted]">
              <span>已用 {formatBytes(used)} / {formatBytes(quota)}</span>
              <span>{usedPct.toFixed(1)}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-[--color-bg-hover] overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${usedPct}%`,
                  backgroundColor: usedPct > 80 ? "var(--color-warning)" : "var(--color-accent)",
                }}
              />
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="flex items-center justify-center h-40 text-[--color-text-muted] text-sm">加载中...</div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2 text-[--color-text-muted]">
              <ImageOff size={32} strokeWidth={1.5} />
              <span className="text-sm">还没有上传过图片</span>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {items.map((item, idx) => (
                <div
                  key={item.id}
                  className="group relative rounded-[--radius-md] border border-[--color-border] overflow-hidden bg-[--color-bg-hover] cursor-pointer"
                  onClick={() => setLightbox(idx)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.url}
                    alt={item.originalName}
                    className="w-full aspect-square object-cover"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleCopyMarkdown(item) }}
                        className="p-1 rounded bg-white/20 hover:bg-white/40 transition-colors"
                        title="复制 Markdown"
                      >
                        <Copy size={13} className="text-white" />
                      </button>
                      <a
                        href={item.url}
                        download={item.originalName}
                        onClick={(e) => e.stopPropagation()}
                        className="p-1 rounded bg-white/20 hover:bg-white/40 transition-colors"
                        title="下载"
                      >
                        <Download size={13} className="text-white" />
                      </a>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(item.id) }}
                        className="p-1 rounded bg-white/20 hover:bg-red-500/80 transition-colors"
                        title="删除"
                      >
                        <Trash2 size={13} className="text-white" />
                      </button>
                    </div>
                    <div className="space-y-1">
                      <p className="text-white text-xs truncate">{item.originalName}</p>
                      <p className="text-white/70 text-xs">{formatBytes(item.size)}</p>
                      {onInsert && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleInsert(item) }}
                          className="w-full text-xs bg-white text-black rounded py-0.5 font-medium hover:bg-gray-100 transition-colors"
                        >
                          插入编辑器
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 px-5 py-3 border-t border-[--color-border] shrink-0">
            <Button
              variant="outline" size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft size={14} />
            </Button>
            <span className="text-xs text-[--color-text-muted]">{page} / {totalPages}</span>
            <Button
              variant="outline" size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              <ChevronRight size={14} />
            </Button>
          </div>
        )}
      </DialogContent>

      {lightbox !== null && (
        <div
          className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center"
          onClick={() => setLightbox(null)}
        >
          <button
            className="absolute top-4 right-4 p-2 rounded-full bg-white/20 hover:bg-white/40 transition-colors"
            onClick={() => setLightbox(null)}
          >
            <X size={20} className="text-white" />
          </button>
          {lightbox > 0 && (
            <button
              className="absolute left-4 p-2 rounded-full bg-white/20 hover:bg-white/40 transition-colors"
              onClick={(e) => { e.stopPropagation(); setLightbox((l) => (l ?? 1) - 1) }}
            >
              <ChevronLeft size={20} className="text-white" />
            </button>
          )}
          {lightbox < items.length - 1 && (
            <button
              className="absolute right-4 p-2 rounded-full bg-white/20 hover:bg-white/40 transition-colors"
              onClick={(e) => { e.stopPropagation(); setLightbox((l) => (l ?? 0) + 1) }}
            >
              <ChevronRight size={20} className="text-white" />
            </button>
          )}
          <div className="max-w-[90vw] max-h-[calc(var(--app-viewport-height)-2rem)]" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={items[lightbox]?.url}
              alt={items[lightbox]?.originalName}
              className="max-w-full max-h-[calc(var(--app-viewport-height)-6rem)] object-contain rounded"
            />
            <div className="flex items-center justify-between mt-2 px-1">
              <p className="text-white/80 text-sm">{items[lightbox]?.originalName}</p>
              <div className="flex gap-2">
                <button
                  onClick={() => handleCopyUrl(items[lightbox!])}
                  className="text-white/70 hover:text-white text-xs flex items-center gap-1 transition-colors"
                >
                  <Copy size={12} /> 复制链接
                </button>
                <a
                  href={items[lightbox]?.url}
                  download={items[lightbox]?.originalName}
                  className="text-white/70 hover:text-white text-xs flex items-center gap-1 transition-colors"
                >
                  <Download size={12} /> 下载
                </a>
                {onInsert && (
                  <button
                    onClick={() => { handleInsert(items[lightbox!]); setLightbox(null) }}
                    className="text-white/70 hover:text-white text-xs flex items-center gap-1 transition-colors"
                  >
                    插入编辑器
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </Dialog>
  )
}
