"use client"

import Link from "next/link"
import { BookOpen, CalendarDays, FileText, Lightbulb, PanelLeft, StickyNote } from "lucide-react"
import { useState, type ReactNode } from "react"
import type { ArticleWorkspaceNav } from "@/lib/article-workspace"
import type { PostType } from "@/lib/enums"
import { cn } from "@/lib/utils"
import { WorkspaceSidebarBody } from "@/components/article-workspace-sidebar-body"
import { MobileSidebarDrawer } from "@/components/mobile-sidebar-drawer"

type ArticleWorkspaceShellProps = {
  workspaceNav?: ArticleWorkspaceNav
  children: ReactNode
  rightRail?: ReactNode
  mobileAfter?: ReactNode
  className?: string
}

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

function WorkspaceSidebar({ nav }: { nav: ArticleWorkspaceNav }) {
  return (
    <aside className="article-workspace-sidebar hidden md:block">
      <WorkspaceSidebarBody nav={nav} />
    </aside>
  )
}

function MobileModuleNav({ nav }: { nav: ArticleWorkspaceNav }) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  return (
    <>
      <nav className="article-workspace-mobile-nav md:hidden" aria-label="Article modules">
        <button
          type="button"
          aria-label="打开侧边栏"
          onClick={() => setDrawerOpen(true)}
          className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-md px-3 text-sm text-[--color-text-secondary] hover:bg-[--color-bg-hover] hover:no-underline"
        >
          <PanelLeft className="h-4 w-4" />
        </button>
        <span aria-hidden="true" className="h-5 w-px self-center bg-[--color-border]" />
        {nav.modules.map((module) => (
          <Link
            key={module.type}
            href={module.latestHref}
            className={cn(
              "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md px-3 text-sm text-[--color-text-secondary] hover:no-underline",
              module.type === nav.currentType && "bg-[--color-bg-surface] font-medium text-[--color-text-primary] shadow-[inset_0_0_0_1px_var(--color-border)]"
            )}
          >
            <ModuleIcon type={module.type} className="h-4 w-4" />
            {module.label}
          </Link>
        ))}
      </nav>
      <MobileSidebarDrawer open={drawerOpen} onOpenChange={setDrawerOpen} nav={nav} />
    </>
  )
}

export function ArticleWorkspaceShell({ workspaceNav, children, rightRail, mobileAfter, className }: ArticleWorkspaceShellProps) {
  return (
    <div className={cn("article-workspace-shell", className)}>
      <div
        className={cn(
          "article-workspace-grid",
          workspaceNav && rightRail && "md:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[260px_minmax(0,1fr)_300px]",
          workspaceNav && !rightRail && "md:grid-cols-[260px_minmax(0,1fr)]",
          !workspaceNav && rightRail && "xl:grid-cols-[minmax(0,1fr)_300px]",
          !workspaceNav && !rightRail && "md:grid-cols-[minmax(0,1fr)]"
        )}
      >
        {workspaceNav ? <WorkspaceSidebar nav={workspaceNav} /> : null}
        <main className="article-workspace-main">
          {workspaceNav ? <MobileModuleNav nav={workspaceNav} /> : null}
          {children}
          {mobileAfter ? <div className="article-workspace-mobile-after md:hidden">{mobileAfter}</div> : null}
        </main>
        {rightRail ? <div className="article-workspace-right hidden xl:block">{rightRail}</div> : null}
      </div>
    </div>
  )
}

