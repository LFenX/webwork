"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { ChevronRight, FileText, Folder } from "lucide-react"
import type { ArticleWorkspaceFolder, ArticleWorkspaceModule, ArticleWorkspaceNav, ArticleWorkspacePost } from "@/lib/article-workspace"
import { cn } from "@/lib/utils"

interface ArticleFolderTreeProps {
  module: ArticleWorkspaceModule
  currentSlug?: string
}

function articleHref(modulePath: string, slug: string) {
  return `${modulePath}/${encodeURIComponent(slug)}`
}

function loadCollapseState(typeKey: string): Record<string, boolean> {
  if (typeof window === "undefined") return {}
  try {
    const raw = window.localStorage.getItem(`folder-state:${typeKey}`)
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {}
  } catch {
    return {}
  }
}

function saveCollapseState(typeKey: string, state: Record<string, boolean>) {
  try { window.localStorage.setItem(`folder-state:${typeKey}`, JSON.stringify(state)) } catch { /* ignore */ }
}

function PostRow({ modulePath, post, active }: { modulePath: string; post: ArticleWorkspacePost; active: boolean }) {
  return (
    <Link
      href={articleHref(modulePath, post.slug)}
      className={cn(
        "flex items-center gap-1.5 rounded-md px-2 py-1.5 hover:bg-[--color-bg-hover] hover:no-underline",
        active && "bg-[--color-bg-surface] shadow-[inset_0_0_0_1px_var(--color-border)]"
      )}
    >
      <FileText className="h-3 w-3 shrink-0 text-[--color-text-muted]" />
      <span className={cn("min-w-0 flex-1 truncate text-xs", active ? "font-medium text-[--color-text-primary]" : "text-[--color-text-secondary]")}>
        {post.title}
      </span>
    </Link>
  )
}

function FolderRow({
  folder,
  modulePath,
  currentSlug,
  collapsed,
  onToggle,
}: {
  folder: ArticleWorkspaceFolder
  modulePath: string
  currentSlug?: string
  collapsed: boolean
  onToggle: () => void
}) {
  return (
    <div className="space-y-0.5">
      <button
        type="button"
        onClick={onToggle}
        className="group flex w-full items-center gap-1 rounded-md px-1.5 py-1 text-left hover:bg-[--color-bg-hover]"
      >
        <ChevronRight
          className={cn("h-3 w-3 shrink-0 text-[--color-text-muted] transition-transform", !collapsed && "rotate-90")}
        />
        <Folder className="h-3.5 w-3.5 shrink-0 text-[--color-text-muted]" />
        <span className="min-w-0 flex-1 truncate text-xs font-medium text-[--color-text-secondary]">
          {folder.name}
        </span>
        <span className="text-[10px] text-[--color-text-muted]">{folder.posts.length}</span>
      </button>
      {!collapsed && folder.posts.length > 0 ? (
        <div className="ml-4 space-y-0.5">
          {folder.posts.map((post) => (
            <PostRow key={post.id} modulePath={modulePath} post={post} active={post.slug === currentSlug} />
          ))}
        </div>
      ) : null}
    </div>
  )
}

export function ArticleFolderTree({ module, currentSlug }: ArticleFolderTreeProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot hydration of persisted UI state
    setCollapsed(loadCollapseState(module.type))
    setHydrated(true)
  }, [module.type])

  function toggle(folderId: string) {
    setCollapsed((prev) => {
      const next = { ...prev, [folderId]: !prev[folderId] }
      saveCollapseState(module.type, next)
      return next
    })
  }

  return (
    <div className="space-y-1">
      {module.folders.map((folder) => (
        <FolderRow
          key={folder.id}
          folder={folder}
          modulePath={module.href}
          currentSlug={currentSlug}
          collapsed={hydrated ? Boolean(collapsed[folder.id]) : false}
          onToggle={() => toggle(folder.id)}
        />
      ))}
      {module.unfiled.length > 0 ? (
        <div className="space-y-0.5">
          {module.folders.length > 0 ? (
            <p className="px-2 pt-1.5 text-[10px] font-medium uppercase tracking-wider text-[--color-text-muted]">
              未分类
            </p>
          ) : null}
          {module.unfiled.map((post) => (
            <PostRow key={post.id} modulePath={module.href} post={post} active={post.slug === currentSlug} />
          ))}
        </div>
      ) : null}
      {module.posts.length === 0 ? (
        <p className="px-2 py-2 text-xs text-[--color-text-muted]">这里还没有文章</p>
      ) : null}
    </div>
  )
}

export function ArticleFolderTreeNav({ nav }: { nav: ArticleWorkspaceNav }) {
  const activeModule = nav.modules.find((m) => m.type === nav.currentType) ?? nav.modules[0]
  if (!activeModule) return null
  return <ArticleFolderTree module={activeModule} currentSlug={nav.currentSlug} />
}
