"use client"

import { useCallback } from "react"
import { Globe, ExternalLink, Copy, FolderInput } from "lucide-react"
import { UserAvatar } from "@/components/user-avatar"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { copyTextWithToast } from "@/lib/interaction-feedback"
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

  const handleVisit = (e: React.MouseEvent) => {
    e.stopPropagation()
    recordVisit()
    window.open(resource.url, "_blank", "noopener,noreferrer")
  }

  const handleCopyLink = (e: React.MouseEvent) => {
    e.stopPropagation()
    void copyTextWithToast(resource.url, "链接已复制", "复制失败，请手动复制")
  }

  const imgStyle: React.CSSProperties = fitMode === "cover"
    ? { objectFit: "cover" as const, objectPosition: `${posX}% ${posY}%`, transform: scale !== 100 ? `scale(${scale / 100})` : undefined }
    : { objectFit: "contain" as const }

  return (
    <div
      onClick={onClick}
      className="group cursor-pointer rounded-[--radius-md] border border-[--color-border] bg-[--color-bg-surface] overflow-hidden transition-all duration-200 hover:border-[--color-border-strong] hover:shadow-[--shadow-sm] hover:-translate-y-0.5"
    >
      {/* Screenshot */}
      <div className="relative aspect-[16/9] bg-[--color-bg-hover] overflow-hidden">
        {resource.screenshotUrl ? (
          <img
            src={resource.screenshotUrl}
            alt={resource.name}
            className="h-full w-full"
            style={imgStyle}
            loading="lazy"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none"
              ;(e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden")
            }}
          />
        ) : null}
        <div className={cn("absolute inset-0 flex items-center justify-center", resource.screenshotUrl ? "hidden" : "")}>
          <Globe size={28} className="text-[--color-text-muted]" />
        </div>

        {/* Hover actions */}
        <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
          <button type="button" onClick={handleVisit} className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-[--color-text-primary] hover:bg-[--color-bg-hover] transition-colors">
            <ExternalLink size={12} />访问
          </button>
          <button type="button" onClick={handleCopyLink} className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-[--color-text-primary] hover:bg-[--color-bg-hover] transition-colors">
            <Copy size={12} />复制
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="p-3">
        <h3 className="text-sm font-semibold text-[--color-text-primary] line-clamp-1">{resource.name}</h3>
        <p className="mt-0.5 text-xs text-[--color-text-muted] line-clamp-1">{resource.domain}</p>
        {resource.description && (
          <p className="mt-1.5 text-xs text-[--color-text-secondary] line-clamp-2 leading-relaxed">{resource.description}</p>
        )}
        {visibleTags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {visibleTags.map((tag) => (
              <button key={tag} type="button" onClick={(e) => { e.stopPropagation(); onTagClick(tag) }} className="inline-flex items-center rounded-full bg-[--color-brand-soft] px-2 py-0.5 text-[11px] text-[--color-brand] hover:bg-[--color-brand] hover:text-white transition-colors">{tag}</button>
            ))}
            {extraCount > 0 && <Badge variant="secondary" className="text-[11px] px-2 py-0.5">+{extraCount}</Badge>}
          </div>
        )}
        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-1.5 min-w-0">
            <UserAvatar size="sm" name={resource.user.displayName || resource.user.email} email={resource.user.email} avatarText={resource.user.avatarText} avatarUrl={resource.user.avatarUrl} />
            <span className="text-xs text-[--color-text-muted] truncate">{resource.user.displayName || resource.user.email}</span>
          </div>
          <span className="shrink-0 text-[11px] text-[--color-text-muted]">{timeAgo(resource.createdAt)}</span>
        </div>
        {resource.folder && (
          <div className="mt-2 flex items-center gap-1 text-[11px] text-[--color-text-muted]">
            <FolderInput size={11} />
            <span className="line-clamp-1">{resource.folder.name}</span>
          </div>
        )}
      </div>
    </div>
  )
}
