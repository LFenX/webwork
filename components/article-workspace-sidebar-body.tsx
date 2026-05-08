"use client"

import Link from "next/link"
import { BookOpen, CalendarDays, FileText, Lightbulb, Plus, StickyNote } from "lucide-react"
import { ArticleFolderTree } from "@/components/article-folder-tree"
import type { ArticleWorkspaceNav } from "@/lib/article-workspace"
import type { PostType } from "@/lib/enums"
import { cn } from "@/lib/utils"

const moduleIcons: Record<PostType, typeof BookOpen> = {
  blog: BookOpen,
  daily: CalendarDays,
  reflections: Lightbulb,
  notes: StickyNote,
}

function ModuleIcon({ type, className }: { type: PostType; className?: string }) {
  const Icon = moduleIcons[type] ?? FileText
  return <Icon className={className} aria-hidden="true" />
}

export function WorkspaceSidebarBody({ nav }: { nav: ArticleWorkspaceNav }) {
  const activeModule = nav.modules.find((item) => item.type === nav.currentType) ?? nav.modules[0]

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="px-3 pb-3 pt-4">
        <p className="truncate text-sm font-semibold text-[--color-text-primary]">{nav.title}</p>
        <p className="mt-0.5 text-xs text-[--color-text-muted]">{nav.sectionLabel}</p>
      </div>

      <nav className="space-y-1 px-2" aria-label="Article modules">
        {nav.modules.map((module) => {
          const active = module.type === nav.currentType
          return (
            <Link
              key={module.type}
              href={module.latestHref}
              className={cn(
                "group flex h-8 items-center gap-2 rounded-md px-2 text-sm text-[--color-text-secondary] hover:bg-[--color-bg-hover] hover:text-[--color-text-primary] hover:no-underline",
                active && "bg-[--color-bg-surface] font-medium text-[--color-text-primary] shadow-[inset_0_0_0_1px_var(--color-border)]"
              )}
            >
              <ModuleIcon type={module.type} className="h-4 w-4 shrink-0" />
              <span className="min-w-0 flex-1 truncate">{module.label}</span>
              <span className="text-xs text-[--color-text-muted]">{module.posts.length}</span>
            </Link>
          )
        })}
      </nav>

      {activeModule ? (
        <div className="mt-4 min-h-0 flex-1 overflow-y-auto px-2 pb-5">
          <div className="mb-2 flex items-center justify-between px-2">
            <p className="text-xs font-medium text-[--color-text-muted]">{activeModule.label}</p>
            {activeModule.newHref ? (
              <Link
                href={activeModule.newHref}
                className="inline-flex h-6 w-6 items-center justify-center rounded-md text-[--color-text-muted] hover:bg-[--color-bg-hover] hover:text-[--color-text-primary]"
                aria-label="New article"
              >
                <Plus className="h-3.5 w-3.5" />
              </Link>
            ) : null}
          </div>
          <ArticleFolderTree module={activeModule} currentSlug={nav.currentSlug} />
        </div>
      ) : null}
    </div>
  )
}
