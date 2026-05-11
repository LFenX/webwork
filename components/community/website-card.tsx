"use client"

import { useCallback, type CSSProperties, type MouseEvent } from "react"
import { Copy, ExternalLink, FolderInput, Globe } from "lucide-react"
import { UserAvatar } from "@/components/user-avatar"
import { Badge } from "@/components/ui/badge"
import { copyTextWithToast } from "@/lib/interaction-feedback"
import { cn } from "@/lib/utils"
import type { WebsiteResource } from "./website-share-client"

function timeAgo(date: string) {
  const now = Date.now()
  const then = new Date(date).getTime()
  const diff = now - then
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "刚刚"
  if (mins < 60) return `${mins} 分钟前`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} 小时前`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} 天前`
  const months = Math.floor(days / 30)
  return `${months} 个月前`
}

interface WebsiteCardProps {
  resource: WebsiteResource
  onClick: () => void
  onTagClick: (tag: string) => void
}

export function WebsiteCard({ resource, onClick, onTagClick }: WebsiteCardProps) {
  const tags = Array.isArray(resource.tags) ? resource.tags : []
  const visibleTags = tags.slice(0, 3)
  const extraCount = tags.length - 3

  const posX = resource.screenshotPositionX ?? 50
  const posY = resource.screenshotPositionY ?? 50
  const scale = resource.screenshotScale ?? 100
  const fitMode = resource.screenshotFitMode || "cover"

  const recordVisit = useCallback(() => {
    fetch(`/api/websites/${resource.id}/visit`, { method: "POST", cache: "no-store" }).catch(() => null)
  }, [resource.id])

  const handleVisit = (event: MouseEvent) => {
    event.stopPropagation()
    recordVisit()
    window.open(resource.url, "_blank", "noopener,noreferrer")
  }

  const handleCopyLink = (event: MouseEvent) => {
    event.stopPropagation()
    void copyTextWithToast(resource.url, "链接已复制", "复制失败，请手动复制")
  }

  const imgStyle: CSSProperties = fitMode === "cover"
    ? { objectFit: "cover" as const, objectPosition: `${posX}% ${posY}%`, transform: scale !== 100 ? `scale(${scale / 100})` : undefined }
    : { objectFit: "contain" as const }

  return (
    <div
      onClick={onClick}
      className="group cursor-pointer overflow-hidden rounded-[20px] border border-slate-200/80 bg-white shadow-[0_14px_34px_rgba(15,23,42,0.055)] transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-[0_22px_46px_rgba(15,23,42,0.075)]"
    >
      <div className="relative aspect-[16/9] overflow-hidden bg-gradient-to-br from-blue-50 to-slate-100">
        {resource.screenshotUrl ? (
          <img
            src={resource.screenshotUrl}
            alt={resource.name}
            className="h-full w-full transition-transform duration-500 group-hover:scale-[1.02]"
            style={imgStyle}
            loading="lazy"
            onError={(event) => {
              (event.target as HTMLImageElement).style.display = "none"
              ;(event.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden")
            }}
          />
        ) : null}
        <div className={cn("absolute inset-0 flex items-center justify-center", resource.screenshotUrl ? "hidden" : "")}>
          <Globe size={30} className="text-blue-300" />
        </div>

        <div className="absolute inset-0 flex items-center justify-center gap-2 bg-slate-950/42 opacity-0 transition-opacity group-hover:opacity-100">
          <button type="button" onClick={handleVisit} className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-white px-3 text-xs font-semibold text-slate-900 shadow-sm transition hover:bg-blue-50 hover:text-blue-600">
            <ExternalLink size={13} /> 访问
          </button>
          <button type="button" onClick={handleCopyLink} className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-white px-3 text-xs font-semibold text-slate-900 shadow-sm transition hover:bg-blue-50 hover:text-blue-600">
            <Copy size={13} /> 复制
          </button>
        </div>
      </div>

      <div className="p-4">
        <h3 className="line-clamp-1 text-base font-bold text-slate-950">{resource.name}</h3>
        <p className="mt-0.5 line-clamp-1 text-xs text-slate-400">{resource.domain}</p>
        {resource.description && (
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-500">{resource.description}</p>
        )}
        {visibleTags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {visibleTags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={(event) => { event.stopPropagation(); onTagClick(tag) }}
                className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-600 hover:text-white"
              >
                {tag}
              </button>
            ))}
            {extraCount > 0 && <Badge variant="secondary" className="rounded-full px-2.5 py-1 text-xs">+{extraCount}</Badge>}
          </div>
        )}
        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <UserAvatar size="sm" name={resource.user.displayName || resource.user.email} email={resource.user.email} avatarText={resource.user.avatarText} avatarUrl={resource.user.avatarUrl} />
            <span className="truncate text-xs text-slate-500">{resource.user.displayName || resource.user.email}</span>
          </div>
          <span className="shrink-0 text-xs text-slate-400">{timeAgo(resource.createdAt)}</span>
        </div>
        {resource.folder && (
          <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-400">
            <FolderInput size={12} />
            <span className="line-clamp-1">{resource.folder.name}</span>
          </div>
        )}
      </div>
    </div>
  )
}
