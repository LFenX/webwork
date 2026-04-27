"use client"

import { FolderInput, Plus, Pencil, MoreHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { UserAvatar } from "@/components/user-avatar"
import type { FolderItem } from "./website-share-client"

interface Props {
  folders: FolderItem[]
  activeFolderId: string
  onSelectFolder: (folderId: string) => void
  session: { userId: string; email: string } | null
  onEditFolder: (folder: FolderItem) => void
  onNewFolder: () => void
  onRefresh: () => void
}

export function WebsiteFolderSidebar({
  folders, activeFolderId, onSelectFolder, session, onEditFolder, onNewFolder,
}: Props) {
  return (
    <div className="hidden lg:block w-[240px] shrink-0">
      <div className="sticky top-[5rem] space-y-1">
        <div className="flex items-center justify-between mb-3 px-1">
          <h3 className="text-xs font-medium text-[--color-text-muted] uppercase tracking-wider">探索文件夹</h3>
          {session && (
            <button
              type="button"
              onClick={onNewFolder}
              className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[--color-text-muted] hover:bg-[--color-bg-hover] hover:text-[--color-text-primary] transition-colors"
            >
              <Plus size={14} />
            </button>
          )}
        </div>

        {/* "All" item */}
        <button
          type="button"
          onClick={() => onSelectFolder("")}
          className={`flex w-full items-center gap-2 rounded-[--radius-sm] px-3 py-2 text-sm transition-colors ${
            !activeFolderId
              ? "bg-[--color-brand-soft] text-[--color-brand] font-medium"
              : "text-[--color-text-secondary] hover:bg-[--color-bg-hover]"
          }`}
        >
          <FolderInput size={14} />
          <span className="flex-1 text-left">全部网站</span>
        </button>

        {folders.length === 0 ? (
          <p className="px-3 py-2 text-xs text-[--color-text-muted]">
            {session ? "创建文件夹来整理网站资源" : "暂无文件夹"}
          </p>
        ) : (
          folders.map((folder) => (
            <div key={folder.id} className="group relative">
              <button
                type="button"
                onClick={() => onSelectFolder(folder.id)}
                className={`flex w-full items-center gap-2 rounded-[--radius-sm] px-3 py-2 text-sm transition-colors ${
                  activeFolderId === folder.id
                    ? "bg-[--color-brand-soft] text-[--color-brand] font-medium"
                    : "text-[--color-text-secondary] hover:bg-[--color-bg-hover]"
                }`}
              >
                <FolderInput size={14} />
                <span className="flex-1 text-left truncate">{folder.name}</span>
                <span className="text-xs text-[--color-text-muted]">
                  {folder._count?.websites ?? 0}
                </span>
              </button>

              {/* Creator + edit button (visible on hover) */}
              {(folder.user || session?.userId === folder.userId) && (
                <div className="mt-0.5 flex items-center gap-1 ml-3 pl-7">
                  {folder.user && (
                    <div className="flex items-center gap-1 min-w-0 flex-1 text-[11px] text-[--color-text-muted]">
                      <UserAvatar
                        size="sm"
                        name={folder.user.displayName || folder.user.email}
                        email={folder.user.email}
                        avatarText={folder.user.avatarText}
                        avatarUrl={folder.user.avatarUrl}
                      />
                      <span className="truncate">{folder.user.displayName || folder.user.email}</span>
                    </div>
                  )}
                  {session?.userId === folder.userId && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onEditFolder(folder) }}
                      className="shrink-0 inline-flex h-5 w-5 items-center justify-center rounded text-[--color-text-muted] hover:bg-[--color-bg-hover] hover:text-[--color-text-primary] transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <MoreHorizontal size={12} />
                    </button>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
