"use client"

import { useCallback, useEffect, useState } from "react"
import { ExternalLink, Copy, Trash2, Pencil, Globe } from "lucide-react"
import { toast } from "sonner"
import { UserAvatar } from "@/components/user-avatar"
import { Button } from "@/components/ui/button"
import { confirmAction, copyTextWithToast } from "@/lib/interaction-feedback"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import type { WebsiteResource } from "./website-share-client"

interface Props {
  websiteId: string | null
  onClose: () => void
  session: { userId: string; email: string } | null
  onEdit: (website: WebsiteResource) => void
  onDelete: (websiteId: string) => void
  onTagClick: (tag: string) => void
  onFolderClick: (folderId: string) => void
  onUserClick: (userId: string) => void
}

export function WebsiteDetailSheet({
  websiteId, onClose, session, onEdit, onDelete, onTagClick, onFolderClick, onUserClick,
}: Props) {
  const [website, setWebsite] = useState<WebsiteResource | null>(null)
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!websiteId) return
    let cancelled = false
    queueMicrotask(() => { if (!cancelled) setLoading(true) })
    fetch(`/api/websites/${websiteId}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return
        setWebsite(data.error ? null : data)
        setLoading(false)
      })
      .catch(() => { if (!cancelled) { setWebsite(null); setLoading(false) } })
    return () => { cancelled = true }
  }, [websiteId])

  const isOwner = session?.userId === website?.user.id

  const recordVisit = useCallback(() => {
    if (!website) return
    fetch(`/api/websites/${website.id}/visit`, { method: "POST", cache: "no-store" }).catch(() => null)
  }, [website])

  const handleVisit = () => {
    if (!website) return
    recordVisit()
    window.open(website.url, "_blank", "noopener,noreferrer")
  }

  const handleCopy = () => {
    if (!website) return
    void copyTextWithToast(website.url, "链接已复制", "复制失败，请手动复制")
  }

  const handleDelete = async () => {
    if (!website) return
    if (!confirmAction(`确定删除网站资源“${website.name}”？删除后将从资源列表中移除，无法直接恢复。`)) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/websites/${website.id}`, { method: "DELETE", cache: "no-store" })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error ?? "删除失败")
      }
      toast.success("资源已删除")
      onDelete(website.id)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "删除失败")
    } finally {
      setDeleting(false)
    }
  }

  const posX = website?.screenshotPositionX ?? 50
  const posY = website?.screenshotPositionY ?? 50
  const scale = website?.screenshotScale ?? 100
  const fitMode = website?.screenshotFitMode || "cover"
  const imgStyle: React.CSSProperties = fitMode === "cover"
    ? { objectFit: "cover" as const, objectPosition: `${posX}% ${posY}%`, transform: scale !== 100 ? `scale(${scale / 100})` : undefined }
    : { objectFit: "contain" as const }

  return (
    <Sheet open={!!websiteId} onOpenChange={(open) => { if (!open) onClose() }}>
      <SheetContent side="right" className="w-full sm:max-w-[460px] overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-sm text-[--color-text-muted]">加载中...</div>
        ) : !website ? (
          <div className="flex items-center justify-center py-20 text-sm text-[--color-text-muted]">资源不存在</div>
        ) : (
          <>
            <SheetHeader className="mb-4"><SheetTitle className="sr-only">{website.name}</SheetTitle></SheetHeader>
            <div className="aspect-[16/9] rounded-[--radius-md] bg-[--color-bg-hover] overflow-hidden">
              {website.screenshotUrl ? (
                <img src={website.screenshotUrl} alt={website.name} className="h-full w-full" style={imgStyle} onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }} />
              ) : (
                <div className="flex h-full w-full items-center justify-center"><Globe size={40} className="text-[--color-text-muted]" /></div>
              )}
            </div>
            <div className="mt-4 space-y-3">
              <h2 className="text-lg font-semibold text-[--color-text-primary]">{website.name}</h2>
              <p className="text-sm text-[--color-text-muted]">{website.domain}</p>
              {website.description && <p className="text-sm text-[--color-text-secondary] leading-relaxed">{website.description}</p>}
              {Array.isArray(website.tags) && website.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {website.tags.map((t) => (<button key={t} type="button" onClick={() => { onTagClick(t); onClose() }} className="rounded-full bg-[--color-brand-soft] px-2.5 py-1 text-xs text-[--color-brand] hover:bg-[--color-brand] hover:text-white transition-colors">{t}</button>))}
                </div>
              )}
              {website.folder && (
                <button type="button" onClick={() => { onFolderClick(website.folder!.id); onClose() }} className="inline-flex items-center gap-1.5 text-sm text-[--color-text-secondary] hover:text-[--color-brand] transition-colors">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
                  {website.folder.name}
                </button>
              )}
              <button type="button" onClick={() => { onUserClick(website.user.id); onClose() }} className="flex items-center gap-2 text-sm">
                <UserAvatar size="sm" name={website.user.displayName || website.user.email} email={website.user.email} avatarText={website.user.avatarText} avatarUrl={website.user.avatarUrl} />
                <div>
                  <p className="text-sm font-medium text-[--color-text-primary]">{website.user.displayName || website.user.email}</p>
                  <p className="text-xs text-[--color-text-muted]">{new Date(website.createdAt).toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" })}</p>
                </div>
              </button>
            </div>
            <div className="mt-6 flex gap-2">
              <Button onClick={handleVisit} className="flex-1 gap-1.5"><ExternalLink size={14} />访问网站</Button>
              <Button variant="outline" onClick={handleCopy} className="gap-1.5"><Copy size={14} />复制链接</Button>
            </div>
            {isOwner && (
              <div className="mt-3 flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => { onEdit(website); onClose() }} className="gap-1.5"><Pencil size={14} />编辑</Button>
                <Button variant="ghost" size="sm" onClick={handleDelete} loading={deleting} loadingText="删除中..." className="gap-1.5 text-[--color-danger] hover:text-[--color-danger]"><Trash2 size={14} />删除</Button>
              </div>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
