"use client"

import { Search, Plus, X, SlidersHorizontal } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { UserAvatar } from "@/components/user-avatar"
import type { FolderItem } from "./website-share-client"

export type UserContributor = {
  id: string
  displayName: string
  avatarText: string
  avatarUrl: string | null
  websiteCount: number
}

interface Props {
  q: string
  onQChange: (v: string) => void
  tag: string
  folders: FolderItem[]
  activeFolderId: string
  onSelectFolder: (folderId: string) => void
  contributors: UserContributor[]
  activeSharedBy: string
  onSelectUser: (userId: string) => void
  activeFilters: string[]
  onClearAll: () => void
  session: { userId: string; email: string } | null
  onOpenForm: () => void
}

export function WebsiteFilterBar({
  q, onQChange, folders, activeFolderId, onSelectFolder,
  contributors, activeSharedBy, onSelectUser,
  activeFilters, onClearAll, session, onOpenForm,
}: Props) {
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false)

  const filterPanel = (
    <div className="space-y-4 p-1">
      {/* Folder filter */}
      <div>
        <p className="mb-2 text-xs font-medium text-[--color-text-muted]">文件夹</p>
        <div className="space-y-1">
          <button
            type="button"
            onClick={() => onSelectFolder("")}
            className={`block w-full rounded-[--radius-sm] px-2 py-1.5 text-left text-sm transition-colors ${
              !activeFolderId ? "bg-[--color-brand-soft] text-[--color-brand] font-medium" : "text-[--color-text-secondary] hover:bg-[--color-bg-hover]"
            }`}
          >
            全部文件夹
          </button>
          {folders.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => onSelectFolder(f.id)}
              className={`block w-full rounded-[--radius-sm] px-2 py-1.5 text-left text-sm transition-colors ${
                activeFolderId === f.id ? "bg-[--color-brand-soft] text-[--color-brand] font-medium" : "text-[--color-text-secondary] hover:bg-[--color-bg-hover]"
              }`}
            >
              {f.name}
              <span className="ml-1 text-xs text-[--color-text-muted]">
                ({f._count?.websites ?? 0})
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* User filter */}
      {contributors.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium text-[--color-text-muted]">分享者</p>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            <button
              type="button"
              onClick={() => onSelectUser("")}
              className={`block w-full rounded-[--radius-sm] px-2 py-1.5 text-left text-sm transition-colors ${
                !activeSharedBy ? "bg-[--color-brand-soft] text-[--color-brand] font-medium" : "text-[--color-text-secondary] hover:bg-[--color-bg-hover]"
              }`}
            >
              全部分享者
            </button>
            {contributors.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => onSelectUser(u.id === activeSharedBy ? "" : u.id)}
                className={`flex w-full items-center gap-2 rounded-[--radius-sm] px-2 py-1.5 text-left text-sm transition-colors ${
                  activeSharedBy === u.id ? "bg-[--color-brand-soft] text-[--color-brand] font-medium" : "text-[--color-text-secondary] hover:bg-[--color-bg-hover]"
                }`}
              >
                <UserAvatar size="sm" name={u.displayName || "用户"} email="" avatarText={u.avatarText} avatarUrl={u.avatarUrl} />
                <span className="flex-1 truncate">{u.displayName || "用户"}</span>
                <span className="text-xs text-[--color-text-muted]">{u.websiteCount}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )

  return (
    <div className="space-y-2">
      {/* Search bar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[--color-text-muted]" />
          <input
            type="text"
            value={q}
            onChange={(e) => onQChange(e.target.value)}
            placeholder="搜索网站名称、功能介绍..."
            className="h-10 w-full rounded-full border border-[--color-border-strong] bg-[--color-bg-surface] pl-9 pr-4 text-sm text-[--color-text-primary] outline-none placeholder:text-[--color-text-muted] transition-colors focus:border-[--color-brand] focus:bg-white"
          />
          {q && (
            <button
              type="button"
              onClick={() => onQChange("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[--color-text-muted] hover:text-[--color-text-primary]"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Desktop filter popover */}
        <div className="hidden md:flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                <SlidersHorizontal size={14} />
                筛选
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 max-h-[400px] overflow-y-auto" align="end">
              {filterPanel}
            </PopoverContent>
          </Popover>
          {session && (
            <Button size="sm" onClick={onOpenForm} className="gap-1.5">
              <Plus size={14} />
              发布网站
            </Button>
          )}
        </div>

        {/* Mobile filter / publish */}
        <div className="flex md:hidden items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setMobileFilterOpen((v) => !v)}
            className="gap-1"
          >
            <SlidersHorizontal size={14} />
          </Button>
        </div>
      </div>

      {/* Active filters */}
      {activeFilters.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {activeFilters.map((f) => (
            <span key={f} className="inline-flex items-center gap-1 rounded-full bg-[--color-brand-soft] px-2.5 py-1 text-xs text-[--color-brand]">
              {f}
            </span>
          ))}
          <button
            type="button"
            onClick={onClearAll}
            className="text-xs text-[--color-text-muted] hover:text-[--color-text-primary] transition-colors"
          >
            清空全部
          </button>
        </div>
      )}

      {/* Mobile filter panel */}
      {mobileFilterOpen && (
        <div className="md:hidden rounded-[--radius-md] border border-[--color-border] bg-[--color-bg-surface] p-4 max-h-[60vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-[--color-text-primary]">筛选</span>
            <button
              type="button"
              onClick={() => setMobileFilterOpen(false)}
              className="text-[--color-text-muted] hover:text-[--color-text-primary]"
            >
              <X size={16} />
            </button>
          </div>
          {filterPanel}
        </div>
      )}
    </div>
  )
}
