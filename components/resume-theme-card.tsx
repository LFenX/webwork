"use client"

import type { ResumeThemeInfo } from "@/lib/resume/types"
import { ResumeHtmlIframe } from "@/components/resume-html-iframe"
import { Button } from "@/components/ui/button"
import { Check, Eye, AlertTriangle, ImageOff } from "lucide-react"

export function ResumeThemeCard({
  theme,
  isCurrent,
  snapshotSrcDoc,
  onSelect,
  onPreview,
}: {
  theme: ResumeThemeInfo
  isCurrent: boolean
  snapshotSrcDoc?: string | null
  onSelect: () => void
  onPreview: () => void
}) {
  const canUse = theme.available

  return (
    <div
      className={`rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface] overflow-hidden flex flex-col ${
        canUse ? "" : "opacity-60"
      }`}
    >
      {/* Thumbnail — 静态展示，不发任何网络请求 */}
      <div className="h-[520px] bg-gray-100 relative overflow-hidden border-b border-[--color-border]">
        {!canUse ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-xs text-[--color-text-muted] p-4 text-center">
            <AlertTriangle size={20} className="text-amber-500" />
            <p className="text-red-600 font-medium text-sm">主题不可用</p>
            <p className="leading-relaxed">{theme.unavailableReason}</p>
          </div>
        ) : snapshotSrcDoc ? (
          <ResumeHtmlIframe
            srcDoc={snapshotSrcDoc}
            title={`${theme.label} 预览`}
            minHeight={520}
            viewportWidth={1180}
            mode="thumbnail"
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-[--color-text-muted]">
            <ImageOff size={28} className="opacity-30" />
            <p className="text-sm">点击「预览」查看效果</p>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-5 space-y-3 flex-1 flex flex-col">
        <div className="flex items-center justify-between gap-2">
          <div>
            <span className="font-semibold text-base">{theme.label}</span>
            {theme.version && (
              <span className="ml-1.5 text-xs text-[--color-text-muted] font-mono">v{theme.version}</span>
            )}
          </div>
          {isCurrent && (
            <span className="inline-flex items-center gap-0.5 text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
              <Check size={12} /> 使用中
            </span>
          )}
        </div>
        <p className="text-xs text-[--color-text-muted] font-mono">{theme.pkg}</p>
        {theme.description && (
          <p className="text-sm text-[--color-text-secondary] leading-relaxed">{theme.description}</p>
        )}
        {theme.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {theme.tags.map((t) => (
              <span
                key={t}
                className="px-2 py-0.5 text-[11px] rounded-full border border-[--color-border] text-[--color-text-muted]"
              >
                {t}
              </span>
            ))}
          </div>
        )}
        {theme.recommendedFor && (
          <p className="text-xs text-[--color-text-muted]">适合：{theme.recommendedFor}</p>
        )}
        {!canUse && theme.unavailableReason && (
          <p className="text-xs text-red-500">不可用：{theme.unavailableReason}</p>
        )}

        <div className="flex-1" />
        <div className="flex gap-2.5 pt-1">
          <Button
            size="default"
            variant="outline"
            onClick={onPreview}
            disabled={!canUse}
            className="gap-1.5 text-sm flex-1"
          >
            <Eye size={14} /> 预览
          </Button>
          <Button
            size="default"
            onClick={onSelect}
            disabled={!canUse || isCurrent}
            className="gap-1.5 text-sm flex-1"
          >
            {!canUse ? "不兼容" : isCurrent ? "使用中" : "使用此模板"}
          </Button>
        </div>
      </div>
    </div>
  )
}
