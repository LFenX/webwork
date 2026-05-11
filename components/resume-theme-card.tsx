"use client"

import { AlertTriangle, Check, Eye, ImageOff } from "lucide-react"

import { ResumeHtmlIframe } from "@/components/resume-html-iframe"
import { Button } from "@/components/ui/button"
import type { ResumeThemeInfo } from "@/lib/resume/types"

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
    <article className={`flex overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.06)] ${canUse ? "" : "opacity-70"}`}>
      <div className="hidden w-[42%] min-w-[220px] border-r border-slate-100 bg-slate-50 md:block">
        <div className="relative h-full min-h-[360px] overflow-hidden">
          {!canUse ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-sm text-slate-500">
              <AlertTriangle size={22} className="text-amber-500" />
              <p className="font-semibold text-rose-600">Template unavailable</p>
              <p className="text-xs leading-relaxed">{theme.unavailableReason}</p>
            </div>
          ) : snapshotSrcDoc ? (
            <ResumeHtmlIframe
              srcDoc={snapshotSrcDoc}
              title={`${theme.label} preview`}
              minHeight={520}
              viewportWidth={1180}
              mode="thumbnail"
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-slate-400">
              <ImageOff size={28} />
              <p className="text-sm">Preview snapshot is not generated.</p>
            </div>
          )}
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-lg font-semibold text-slate-950">
              {theme.label}
              {theme.version ? <span className="ml-2 font-mono text-xs font-normal text-slate-400">v{theme.version}</span> : null}
            </h3>
            <p className="mt-1 truncate font-mono text-xs text-slate-400">{theme.pkg}</p>
          </div>
          {isCurrent ? (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-600">
              <Check size={12} /> Current
            </span>
          ) : null}
        </div>

        {theme.description ? <p className="mt-4 line-clamp-3 text-sm leading-6 text-slate-600">{theme.description}</p> : null}
        {theme.recommendedFor ? <p className="mt-3 text-xs text-slate-500">Recommended for: {theme.recommendedFor}</p> : null}
        {!canUse && theme.unavailableReason ? <p className="mt-3 text-xs text-rose-600">{theme.unavailableReason}</p> : null}

        {theme.tags.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {theme.tags.map((tag) => (
              <span key={tag} className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-500">
                {tag}
              </span>
            ))}
          </div>
        ) : null}

        <div className="mt-auto flex gap-2 pt-5">
          <Button variant="outline" onClick={onPreview} disabled={!canUse} className="h-10 flex-1 rounded-full border-blue-200 text-blue-600">
            <Eye size={14} /> Preview
          </Button>
          <Button onClick={onSelect} disabled={!canUse || isCurrent} className="h-10 flex-1 rounded-full bg-blue-600 text-white hover:bg-blue-700">
            {!canUse ? "Unavailable" : isCurrent ? "In use" : "Use template"}
          </Button>
        </div>
      </div>
    </article>
  )
}
