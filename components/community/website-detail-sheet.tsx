"use client"

import { useCallback, useEffect, useState, type CSSProperties } from "react"
import { Copy, ExternalLink, Globe, Pencil, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { UserAvatar } from "@/components/user-avatar"
import { Button } from "@/components/ui/button"
import { confirmAction, copyTextWithToast } from "@/lib/interaction-feedback"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
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
  websiteId,
  onClose,
  session,
  onEdit,
  onDelete,
  onTagClick,
  onFolderClick,
  onUserClick,
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
    if (!confirmAction(`确定删除网站资源「${website.name}」？删除后将从资源列表中移除。`)) return
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
  const imgStyle: CSSProperties = fitMode === "cover"
    ? { objectFit: "cover" as const, objectPosition: `${posX}% ${posY}%`, transform: scale !== 100 ? `scale(${scale / 100})` : undefined }
    : { objectFit: "contain" as const }

  return (
    <Sheet open={!!websiteId} onOpenChange={(open) => { if (!open) onClose() }}>
      <SheetContent side="right" className="w-full overflow-y-auto bg-white sm:max-w-[500px]">
        {loading ? (
          <WebsiteDetailLoading />
        ) : !website ? (
          <div className="flex items-center justify-center py-20 text-sm text-slate-500">资源不存在</div>
        ) : (
          <>
            <SheetHeader className="mb-4">
              <SheetTitle className="sr-only">{website.name}</SheetTitle>
            </SheetHeader>
            <div className="overflow-hidden rounded-[20px] bg-gradient-to-br from-blue-50 to-slate-100">
              <div className="aspect-[16/9]">
                {website.screenshotUrl ? (
                  <img src={website.screenshotUrl} alt={website.name} className="h-full w-full" style={imgStyle} onError={(event) => { (event.target as HTMLImageElement).style.display = "none" }} />
                ) : (
                  <div className="flex h-full w-full items-center justify-center"><Globe size={42} className="text-blue-300" /></div>
                )}
              </div>
            </div>
            <div className="mt-5 space-y-4">
              <div>
                <h2 className="text-2xl font-bold text-slate-950">{website.name}</h2>
                <p className="mt-1 text-sm text-slate-400">{website.domain}</p>
              </div>
              {website.description && <p className="text-sm leading-6 text-slate-600">{website.description}</p>}
              {Array.isArray(website.tags) && website.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {website.tags.map((tag) => (
                    <button key={tag} type="button" onClick={() => { onTagClick(tag); onClose() }} className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-600 hover:text-white">
                      {tag}
                    </button>
                  ))}
                </div>
              )}
              {website.folder && (
                <button type="button" onClick={() => { onFolderClick(website.folder!.id); onClose() }} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600">
                  {website.folder.name}
                </button>
              )}
              <button type="button" onClick={() => { onUserClick(website.user.id); onClose() }} className="flex items-center gap-2 rounded-[16px] border border-slate-200 bg-slate-50 p-3 text-left">
                <UserAvatar size="sm" name={website.user.displayName || website.user.email} email={website.user.email} avatarText={website.user.avatarText} avatarUrl={website.user.avatarUrl} />
                <div>
                  <p className="text-sm font-semibold text-slate-900">{website.user.displayName || website.user.email}</p>
                  <p className="text-xs text-slate-400">{new Date(website.createdAt).toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" })}</p>
                </div>
              </button>
            </div>
            <div className="mt-6 flex gap-2">
              <Button onClick={handleVisit} className="flex-1"><ExternalLink size={14} />访问网站</Button>
              <Button variant="outline" onClick={handleCopy}><Copy size={14} />复制链接</Button>
            </div>
            {isOwner && (
              <div className="mt-3 flex gap-2">
                <Button variant="outline" size="sm" onClick={() => { onEdit(website); onClose() }}><Pencil size={14} />编辑</Button>
                <Button variant="outline" size="sm" onClick={handleDelete} loading={deleting} loadingText="删除中..." className="text-rose-600 hover:text-rose-600"><Trash2 size={14} />删除</Button>
              </div>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

function WebsiteDetailLoading() {
  return (
    <div className="animate-pulse py-2" aria-busy="true">
      <div className="overflow-hidden rounded-[20px] bg-slate-100">
        <div className="aspect-[16/9]" />
      </div>
      <div className="mt-5 space-y-4">
        <div>
          <div className="h-8 w-2/3 rounded-[12px] bg-slate-100" />
          <div className="mt-2 h-4 w-1/2 rounded-full bg-slate-100" />
        </div>
        <div className="space-y-2">
          <div className="h-4 rounded-full bg-slate-100" />
          <div className="h-4 w-5/6 rounded-full bg-slate-100" />
          <div className="h-4 w-2/3 rounded-full bg-slate-100" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-7 w-16 rounded-full bg-blue-50" />
          ))}
        </div>
        <div className="flex items-center gap-2 rounded-[16px] border border-slate-200 bg-slate-50 p-3">
          <div className="size-9 rounded-full bg-slate-100" />
          <div className="space-y-2">
            <div className="h-4 w-32 rounded-full bg-slate-100" />
            <div className="h-3 w-24 rounded-full bg-slate-100" />
          </div>
        </div>
        <div className="flex gap-2 pt-2">
          <div className="h-10 flex-1 rounded-full bg-blue-50" />
          <div className="h-10 w-28 rounded-full bg-slate-100" />
        </div>
      </div>
    </div>
  )
}
