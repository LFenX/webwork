"use client"

import { FolderInput, Plus, MoreHorizontal } from "lucide-react"
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
  folders,
  activeFolderId,
  onSelectFolder,
  session,
  onEditFolder,
  onNewFolder,
}: Props) {
  return (
    <aside className="hidden lg:block">
      <div className="sticky top-[5rem] rounded-[20px] border border-slate-200/80 bg-white p-4 shadow-[0_14px_34px_rgba(15,23,42,0.055)]">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-950">资源文件夹</h3>
          {session && (
            <button
              type="button"
              onClick={onNewFolder}
              className="inline-flex size-9 items-center justify-center rounded-full bg-blue-50 text-blue-600 transition-colors hover:bg-blue-600 hover:text-white"
              aria-label="新建文件夹"
            >
              <Plus size={16} />
            </button>
          )}
        </div>

        <div className="space-y-1">
          <button
            type="button"
            onClick={() => onSelectFolder("")}
            className={`flex w-full items-center gap-2 rounded-[14px] px-3 py-2.5 text-sm transition-colors ${
              !activeFolderId ? "bg-blue-50 font-semibold text-blue-600" : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            <FolderInput size={16} />
            <span className="flex-1 text-left">全部网站</span>
          </button>

          {folders.length === 0 ? (
            <p className="rounded-[14px] bg-slate-50 px-3 py-3 text-xs leading-5 text-slate-400">
              {session ? "创建文件夹来整理网站资源。" : "暂无文件夹。"}
            </p>
          ) : (
            folders.map((folder) => (
              <div key={folder.id} className="group rounded-[14px]">
                <button
                  type="button"
                  onClick={() => onSelectFolder(folder.id)}
                  className={`flex w-full items-center gap-2 rounded-[14px] px-3 py-2.5 text-sm transition-colors ${
                    activeFolderId === folder.id ? "bg-blue-50 font-semibold text-blue-600" : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <FolderInput size={16} />
                  <span className="min-w-0 flex-1 truncate text-left">{folder.name}</span>
                  <span className="text-xs text-slate-400">{folder._count?.websites ?? 0}</span>
                </button>

                {(folder.user || session?.userId === folder.userId) && (
                  <div className="ml-3 mt-1 flex items-center gap-1 pl-7">
                    {folder.user && (
                      <div className="flex min-w-0 flex-1 items-center gap-1 text-xs text-slate-400">
                        <UserAvatar size="sm" name={folder.user.displayName || folder.user.email} email={folder.user.email} avatarText={folder.user.avatarText} avatarUrl={folder.user.avatarUrl} />
                        <span className="truncate">{folder.user.displayName || folder.user.email}</span>
                      </div>
                    )}
                    {session?.userId === folder.userId && (
                      <button
                        type="button"
                        onClick={(event) => { event.stopPropagation(); onEditFolder(folder) }}
                        className="inline-flex size-7 shrink-0 items-center justify-center rounded-full text-slate-400 opacity-0 transition group-hover:opacity-100 hover:bg-slate-100 hover:text-slate-700"
                        aria-label="编辑文件夹"
                      >
                        <MoreHorizontal size={14} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </aside>
  )
}
