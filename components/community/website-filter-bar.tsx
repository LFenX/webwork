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
  q,
  onQChange,
  folders,
  activeFolderId,
  onSelectFolder,
  contributors,
  activeSharedBy,
  onSelectUser,
  activeFilters,
  onClearAll,
  session,
  onOpenForm,
}: Props) {
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false)

  const filterPanel = (
    <div className="space-y-4 p-1">
      <div>
        <p className="mb-2 text-xs font-semibold text-slate-400">文件夹</p>
        <div className="space-y-1">
          <button
            type="button"
            onClick={() => onSelectFolder("")}
            className={`block w-full rounded-[12px] px-3 py-2 text-left text-sm transition-colors ${
              !activeFolderId ? "bg-blue-50 font-semibold text-blue-600" : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            全部文件夹
          </button>
          {folders.map((folder) => (
            <button
              key={folder.id}
              type="button"
              onClick={() => onSelectFolder(folder.id)}
              className={`block w-full rounded-[12px] px-3 py-2 text-left text-sm transition-colors ${
                activeFolderId === folder.id ? "bg-blue-50 font-semibold text-blue-600" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              {folder.name}
              <span className="ml-1 text-xs text-slate-400">({folder._count?.websites ?? 0})</span>
            </button>
          ))}
        </div>
      </div>

      {contributors.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold text-slate-400">分享者</p>
          <div className="max-h-48 space-y-1 overflow-y-auto">
            <button
              type="button"
              onClick={() => onSelectUser("")}
              className={`block w-full rounded-[12px] px-3 py-2 text-left text-sm transition-colors ${
                !activeSharedBy ? "bg-blue-50 font-semibold text-blue-600" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              全部分享者
            </button>
            {contributors.map((user) => (
              <button
                key={user.id}
                type="button"
                onClick={() => onSelectUser(user.id === activeSharedBy ? "" : user.id)}
                className={`flex w-full items-center gap-2 rounded-[12px] px-3 py-2 text-left text-sm transition-colors ${
                  activeSharedBy === user.id ? "bg-blue-50 font-semibold text-blue-600" : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                <UserAvatar size="sm" name={user.displayName || "用户"} email="" avatarText={user.avatarText} avatarUrl={user.avatarUrl} />
                <span className="min-w-0 flex-1 truncate">{user.displayName || "用户"}</span>
                <span className="text-xs text-slate-400">{user.websiteCount}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )

  return (
    <div className="rounded-[20px] border border-slate-200/80 bg-white p-3 shadow-[0_14px_34px_rgba(15,23,42,0.055)] sm:p-4">
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={q}
            onChange={(event) => onQChange(event.target.value)}
            placeholder="搜索网站名称、功能介绍..."
            className="h-11 w-full rounded-full border border-slate-200 bg-slate-50 pl-10 pr-9 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100"
          />
          {q && (
            <button type="button" onClick={() => onQChange("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">
              <X size={15} />
            </button>
          )}
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <SlidersHorizontal size={14} />
                筛选
              </Button>
            </PopoverTrigger>
            <PopoverContent className="max-h-[400px] w-72 overflow-y-auto rounded-[18px]" align="end">
              {filterPanel}
            </PopoverContent>
          </Popover>
          {session && (
            <Button size="sm" onClick={onOpenForm}>
              <Plus size={14} />
              发布网站
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <Button variant="outline" size="sm" onClick={() => setMobileFilterOpen((value) => !value)} aria-label="筛选">
            <SlidersHorizontal size={15} />
          </Button>
        </div>
      </div>

      {activeFilters.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {activeFilters.map((filter) => (
            <span key={filter} className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-600">
              {filter}
            </span>
          ))}
          <button type="button" onClick={onClearAll} className="text-xs font-medium text-slate-400 transition-colors hover:text-slate-700">
            清空全部
          </button>
        </div>
      )}

      {mobileFilterOpen && (
        <div className="mt-3 max-h-[60vh] overflow-y-auto rounded-[18px] border border-slate-200 bg-slate-50 p-4 md:hidden">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-bold text-slate-900">筛选</span>
            <button type="button" onClick={() => setMobileFilterOpen(false)} className="text-slate-400 hover:text-slate-700">
              <X size={16} />
            </button>
          </div>
          {filterPanel}
        </div>
      )}
    </div>
  )
}
