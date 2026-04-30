"use client"

import type { ResumeThemeInfo } from "@/lib/resume/types"
import { ResumeThemeCard } from "./resume-theme-card"

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
  zh: "中文模板",
  en: "英文模板",
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
    const cat = categoryMap[theme.slug] || "en"
    if (!groups[cat]) groups[cat] = []
    groups[cat].push(theme)
  }

  for (const cat of Object.keys(groups)) {
    groups[cat].sort((a, b) => {
      const oa = sortOrderMap[a.slug] ?? 0
      const ob = sortOrderMap[b.slug] ?? 0
      if (oa !== ob) return oa - ob
      return a.label.localeCompare(b.label)
    })
  }

  const orderedCategories = ["zh", "en"].filter((cat) => groups[cat]?.length > 0)
  // Append any unknown categories
  for (const cat of Object.keys(groups)) {
    if (!orderedCategories.includes(cat)) orderedCategories.push(cat)
  }

  return (
    <div className="space-y-10">
      {orderedCategories.map((cat) => (
        <section key={cat}>
          <h2 className="mb-4 text-sm font-semibold text-[--color-text-secondary]">
            {CATEGORY_LABELS[cat] || cat} ({groups[cat].length})
          </h2>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 xl:grid-cols-3">
            {groups[cat].map((theme) => (
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
