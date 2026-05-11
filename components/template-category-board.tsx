"use client"

import { ResumeThemeCard } from "@/components/resume-theme-card"
import type { ResumeThemeInfo } from "@/lib/resume/types"

interface TemplateCategoryBoardProps {
  themes: ResumeThemeInfo[]
  categoryMap: Record<string, string>
  sortOrderMap?: Record<string, number>
  currentThemeSlug: string | null
  snapshots: Record<string, string>
  onSelect: (theme: ResumeThemeInfo) => void
  onPreview: (theme: ResumeThemeInfo) => void
}

const CATEGORY_LABELS: Record<string, string> = {
  zh: "Chinese templates",
  en: "English templates",
}

export function TemplateCategoryBoard({
  themes,
  categoryMap,
  sortOrderMap = {},
  currentThemeSlug,
  snapshots,
  onSelect,
  onPreview,
}: TemplateCategoryBoardProps) {
  const groups: Record<string, ResumeThemeInfo[]> = {}

  for (const theme of themes) {
    const category = categoryMap[theme.slug] || "en"
    if (!groups[category]) groups[category] = []
    groups[category].push(theme)
  }

  for (const category of Object.keys(groups)) {
    groups[category].sort((a, b) => {
      const aOrder = sortOrderMap[a.slug] ?? 0
      const bOrder = sortOrderMap[b.slug] ?? 0
      if (aOrder !== bOrder) return aOrder - bOrder
      return a.label.localeCompare(b.label)
    })
  }

  const orderedCategories = ["zh", "en"].filter((category) => groups[category]?.length > 0)
  for (const category of Object.keys(groups)) {
    if (!orderedCategories.includes(category)) orderedCategories.push(category)
  }

  return (
    <div className="space-y-6">
      {orderedCategories.map((category) => (
        <section key={category} className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">
              {CATEGORY_LABELS[category] || category}
            </h2>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">
              {groups[category].length} templates
            </span>
          </div>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {groups[category].map((theme) => (
              <ResumeThemeCard
                key={theme.slug}
                theme={theme}
                isCurrent={theme.slug === currentThemeSlug}
                snapshotSrcDoc={snapshots[theme.slug] ?? null}
                onSelect={() => onSelect(theme)}
                onPreview={() => onPreview(theme)}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
