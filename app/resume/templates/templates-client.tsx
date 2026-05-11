"use client"

import Link from "next/link"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Info, LayoutTemplate } from "lucide-react"
import { toast } from "sonner"

import { ModuleHero, ModulePageShell, ModulePanel, ModuleStatGrid, modulePillClass } from "@/components/module/module-shell"
import { TemplateCategoryBoard } from "@/components/template-category-board"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { ResumeThemeInfo } from "@/lib/resume/types"

export function ResumeTemplatesClient({
  themes,
  categoryMap = {},
  sortOrderMap = {},
  currentThemeSlug,
  isOwner = false,
  snapshots = {},
}: {
  themes: ResumeThemeInfo[]
  categoryMap?: Record<string, string>
  sortOrderMap?: Record<string, number>
  currentThemeSlug: string | null
  isOwner?: boolean
  snapshots?: Record<string, string>
}) {
  const router = useRouter()
  const [previewTheme, setPreviewTheme] = useState<ResumeThemeInfo | null>(null)
  const [previewSrcDoc, setPreviewSrcDoc] = useState<string | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  async function openPreview(theme: ResumeThemeInfo) {
    setPreviewTheme(theme)
    setPreviewError(null)
    setPreviewLoading(false)

    if (!theme.available) {
      setPreviewSrcDoc(null)
      setPreviewError(theme.unavailableReason ?? "Template is unavailable.")
      return
    }

    if (snapshots[theme.slug]) {
      setPreviewSrcDoc(snapshots[theme.slug])
      return
    }

    setPreviewSrcDoc(null)
    setPreviewLoading(true)
    try {
      const res = await fetch(`/api/resume/themes/snapshot?slug=${encodeURIComponent(theme.slug)}`, {
        cache: "no-store",
      })
      const data = await res.json()
      if (data.ok) setPreviewSrcDoc(data.html)
      else setPreviewError(data.error || "Preview snapshot is unavailable.")
    } catch {
      setPreviewError("Failed to load preview snapshot.")
    } finally {
      setPreviewLoading(false)
    }
  }

  async function selectTheme(theme: ResumeThemeInfo) {
    try {
      const res = await fetch("/api/resume", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selectedTheme: theme.slug }),
        cache: "no-store",
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Failed to switch template.")
      toast.success(`Template switched to ${theme.label}.`)
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to switch template.")
    }
  }

  const availableCount = themes.filter((theme) => theme.available).length
  const currentTheme = themes.find((theme) => theme.slug === currentThemeSlug)

  return (
    <ModulePageShell maxWidth="full">
      <div className="space-y-5">
        <ModuleHero
          icon={LayoutTemplate}
          title="Resume templates"
          description="Preview, compare, and apply resume templates without changing the underlying resume data."
          stats={[
            { label: "Available", value: String(availableCount) },
            { label: "Total", value: String(themes.length) },
            { label: "Current", value: currentTheme?.label ?? "Default" },
          ]}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Link href="/resume" className={modulePillClass(false)}>
                <ArrowLeft size={15} /> Back
              </Link>
              {isOwner ? (
                <Link href="/admin/resume-themes" className={modulePillClass(false)}>
                  Manage templates
                </Link>
              ) : null}
            </div>
          }
        />

        <ModuleStatGrid
          stats={[
            { label: "Usable templates", value: availableCount },
            { label: "Disabled templates", value: Math.max(0, themes.length - availableCount) },
            { label: "Snapshot cache", value: Object.keys(snapshots).length },
          ]}
        />

        <ModulePanel
          title="Template library"
          description="Cards show layout snapshots, package details, tags, and current availability."
          action={
            <span className="inline-flex items-center gap-1 text-xs text-slate-500">
              <Info size={13} /> Run theme verification after installing new packages.
            </span>
          }
          contentClassName="p-5"
        >
          {themes.length === 0 ? (
            <div className="rounded-[22px] border border-dashed border-blue-200 bg-blue-50/60 p-10 text-center text-sm text-slate-600">
              No resume templates are available yet.
            </div>
          ) : (
            <TemplateCategoryBoard
              themes={themes}
              categoryMap={categoryMap}
              sortOrderMap={sortOrderMap}
              currentThemeSlug={currentThemeSlug}
              snapshots={snapshots}
              onSelect={(theme) => void selectTheme(theme)}
              onPreview={(theme) => void openPreview(theme)}
            />
          )}
        </ModulePanel>

        <Dialog open={!!previewTheme} onOpenChange={(open) => { if (!open) setPreviewTheme(null) }}>
          <DialogContent className="flex h-[95vh] max-h-[95vh] w-[98vw] max-w-[1440px] flex-col gap-0 overflow-hidden rounded-[24px] border-slate-200 p-0 sm:max-w-[1440px]">
            <DialogHeader className="shrink-0 border-b border-slate-100 px-6 py-5">
              <DialogTitle className="flex flex-wrap items-center gap-2 text-lg">
                {previewTheme?.label}
                {previewTheme?.version ? <span className="font-mono text-sm font-normal text-slate-400">v{previewTheme.version}</span> : null}
              </DialogTitle>
            </DialogHeader>
            <div className="min-h-0 flex-1 overflow-auto bg-slate-50">
              {previewLoading ? (
                <div className="flex h-full items-center justify-center text-sm text-slate-500">Loading preview...</div>
              ) : previewError ? (
                <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-slate-500">
                  <p className="font-semibold text-rose-600">Unable to load preview</p>
                  <p>{previewError}</p>
                </div>
              ) : previewSrcDoc ? (
                <div className="flex justify-center px-4 py-6">
                  <iframe
                    srcDoc={previewSrcDoc}
                    title={`${previewTheme?.label ?? "Resume"} preview`}
                    sandbox="allow-same-origin"
                    className="block border-0 shadow-sm"
                    style={{ width: 1180, minHeight: 1500 }}
                  />
                </div>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-slate-500">No preview available.</div>
              )}
            </div>
            {previewTheme ? (
              <div className="flex shrink-0 justify-end border-t border-slate-100 px-6 py-4">
                <Button
                  onClick={() => {
                    void selectTheme(previewTheme)
                    setPreviewTheme(null)
                  }}
                  disabled={!previewTheme.available || previewTheme.slug === currentThemeSlug}
                  className="rounded-full bg-blue-600 text-white hover:bg-blue-700"
                >
                  {!previewTheme.available ? "Unavailable" : previewTheme.slug === currentThemeSlug ? "Current template" : "Use this template"}
                </Button>
              </div>
            ) : null}
          </DialogContent>
        </Dialog>
      </div>
    </ModulePageShell>
  )
}
