"use client"

import { useCallback, useEffect, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Plus, TrendingUp, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { UserAvatar } from "@/components/user-avatar"
import { EmptyState } from "@/components/empty-state"
import { StatsCard } from "@/components/stats-card"
import { ModulePanel, ModuleStatGrid } from "@/components/module/module-shell"
import { WebsiteCard } from "./website-card"
import { WebsiteCardSkeleton } from "./website-card-skeleton"
import { WebsiteFilterBar, type UserContributor } from "./website-filter-bar"
import { WebsiteDetailSheet } from "./website-detail-sheet"
import { WebsiteFormDialog } from "./website-form-dialog"
import { WebsiteFolderSidebar } from "./website-folder-sidebar"
import { WebsiteFolderFormDialog } from "./website-folder-form-dialog"

export type FolderItem = {
  id: string
  name: string
  userId: string
  description?: string
  _count?: { websites: number }
  user?: {
    id: string
    displayName: string
    email: string
    avatarText: string
    avatarUrl: string | null
  }
}

export type WebsiteResource = {
  id: string
  name: string
  url: string
  domain: string
  description: string
  screenshotUrl: string | null
  screenshotPositionX: number
  screenshotPositionY: number
  screenshotScale: number
  screenshotFitMode: string
  tags: string[]
  visibility: string
  folderId: string | null
  createdAt: string
  updatedAt: string
  user: {
    id: string
    displayName: string
    email: string
    avatarText: string
    avatarUrl: string | null
  }
  folder: {
    id: string
    name: string
    userId: string
  } | null
}

type StatsData = {
  topVisited: Array<{ id: string; name: string; domain: string; screenshotUrl: string | null; visitCount: number }>
  topContributors: Array<{ user: { id: string; displayName: string; avatarText: string; avatarUrl: string | null }; websiteCount: number }>
  contributors: UserContributor[]
}

type Props = {
  initialItems: WebsiteResource[]
  initialTotal: number
  initialFolders: FolderItem[]
  session: { userId: string; email: string } | null
  prefilledFolderId?: string
  folderInfo?: {
    id: string
    name: string
    description: string
    user: { id: string; displayName: string; email: string; avatarText: string; avatarUrl: string | null }
    _count: { websites: number }
  } | null
}

export function WebsiteShareClient({
  initialItems,
  initialTotal,
  initialFolders,
  session,
  prefilledFolderId,
  folderInfo,
}: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [items, setItems] = useState<WebsiteResource[]>(initialItems)
  const [total, setTotal] = useState(initialTotal)
  const [folders, setFolders] = useState<FolderItem[]>(initialFolders)
  const [contributors, setContributors] = useState<UserContributor[]>([])
  const [stats, setStats] = useState<StatsData | null>(null)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)

  const [q, setQ] = useState(searchParams.get("q") || "")
  const [tag, setTagState] = useState(searchParams.get("tag") || "")
  const [folderId, setFolderId] = useState(prefilledFolderId || searchParams.get("folderId") || "")
  const [sharedBy, setSharedByState] = useState(searchParams.get("sharedBy") || "")

  const [selectedWebsiteId, setSelectedWebsiteId] = useState<string | null>(searchParams.get("focus"))
  const [formOpen, setFormOpen] = useState(false)
  const [editingWebsite, setEditingWebsite] = useState<WebsiteResource | null>(null)
  const [folderFormOpen, setFolderFormOpen] = useState(false)
  const [editingFolder, setEditingFolder] = useState<FolderItem | null>(null)

  useEffect(() => {
    fetch("/api/websites/stats", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        setStats(data)
        if (Array.isArray(data.contributors)) setContributors(data.contributors)
      })
      .catch(() => null)
  }, [])

  useEffect(() => {
    let cancelled = false
    queueMicrotask(() => { if (!cancelled) setLoading(true) })

    const params = new URLSearchParams()
    params.set("page", String(page))
    params.set("size", "12")
    if (q) params.set("q", q)
    if (tag) params.set("tag", tag)
    if (folderId) params.set("folderId", folderId)
    if (sharedBy) params.set("sharedBy", sharedBy)
    params.set("sort", "latest")

    fetch(`/api/websites?${params.toString()}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return
        setItems(Array.isArray(data.items) ? data.items : [])
        setTotal(data.total ?? 0)
      })
      .catch(() => null)
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [page, q, tag, folderId, sharedBy])

  useEffect(() => {
    const params = new URLSearchParams()
    if (q) params.set("q", q)
    if (tag) params.set("tag", tag)
    if (folderId && !prefilledFolderId) params.set("folderId", folderId)
    if (sharedBy) params.set("sharedBy", sharedBy)
    const qs = params.toString()
    router.replace(qs ? `?${qs}` : window.location.pathname, { scroll: false })
  }, [q, tag, folderId, sharedBy, router, prefilledFolderId])

  const refreshFolders = useCallback(() => {
    fetch("/api/website-folders", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => { if (Array.isArray(data.items)) setFolders(data.items) })
      .catch(() => null)
  }, [])

  const refreshList = useCallback(() => {
    setPage(1)
    const params = new URLSearchParams()
    params.set("page", "1")
    params.set("size", "12")
    if (q) params.set("q", q)
    if (tag) params.set("tag", tag)
    if (folderId) params.set("folderId", folderId)
    if (sharedBy) params.set("sharedBy", sharedBy)
    params.set("sort", "latest")

    fetch(`/api/websites?${params.toString()}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        setItems(Array.isArray(data.items) ? data.items : [])
        setTotal(data.total ?? 0)
      })
      .catch(() => null)

    fetch("/api/websites/stats", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        setStats(data)
        if (Array.isArray(data.contributors)) setContributors(data.contributors)
      })
      .catch(() => null)
  }, [q, tag, folderId, sharedBy])

  const handleTagClick = useCallback((clickedTag: string) => {
    setTagState(clickedTag === tag ? "" : clickedTag)
    setPage(1)
  }, [tag])

  const handleSelectFolder = useCallback((id: string) => {
    setFolderId(id === folderId ? "" : id)
    setPage(1)
  }, [folderId])

  const handleSelectUser = useCallback((userId: string) => {
    setSharedByState(userId === sharedBy ? "" : userId)
    setPage(1)
  }, [sharedBy])

  const handleClearAll = useCallback(() => {
    setQ("")
    setTagState("")
    if (!prefilledFolderId) setFolderId("")
    setSharedByState("")
    setPage(1)
  }, [prefilledFolderId])

  const handleFormSuccess = useCallback(() => {
    setFormOpen(false)
    setEditingWebsite(null)
    refreshList()
    refreshFolders()
  }, [refreshList, refreshFolders])

  const handleDelete = useCallback(() => {
    setSelectedWebsiteId(null)
    refreshList()
    refreshFolders()
  }, [refreshList, refreshFolders])

  const handleFolderFormSuccess = useCallback(() => {
    setFolderFormOpen(false)
    setEditingFolder(null)
    refreshFolders()
  }, [refreshFolders])

  const activeFilters = [
    tag ? `标签: ${tag}` : "",
    folderId && !prefilledFolderId ? `文件夹: ${folders.find((folder) => folder.id === folderId)?.name || folderId}` : "",
    sharedBy ? `分享者: ${contributors.find((user) => user.id === sharedBy)?.displayName || sharedBy}` : "",
  ].filter(Boolean)

  return (
    <div className="grid min-w-0 gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
      <WebsiteFolderSidebar
        folders={folders}
        activeFolderId={folderId}
        onSelectFolder={handleSelectFolder}
        session={session}
        onEditFolder={(folder) => { setEditingFolder(folder); setFolderFormOpen(true) }}
        onNewFolder={() => { setEditingFolder(null); setFolderFormOpen(true) }}
        onRefresh={refreshFolders}
      />

      <div className="min-w-0 space-y-5">
        {folderInfo && (
          <div className="rounded-[20px] border border-slate-200/80 bg-white p-5 shadow-[0_14px_34px_rgba(15,23,42,0.055)]">
            <h1 className="text-xl font-bold text-slate-950">{folderInfo.name}</h1>
            {folderInfo.description && <p className="mt-1 text-sm text-slate-500">{folderInfo.description}</p>}
            <div className="mt-3 flex items-center gap-3 text-xs text-slate-400">
              <div className="flex items-center gap-1.5">
                <UserAvatar size="sm" name={folderInfo.user.displayName || folderInfo.user.email} email={folderInfo.user.email} avatarText={folderInfo.user.avatarText} avatarUrl={folderInfo.user.avatarUrl} />
                <span>{folderInfo.user.displayName || folderInfo.user.email}</span>
              </div>
              <span>/</span>
              <span>{folderInfo._count.websites} 个网站</span>
            </div>
          </div>
        )}

        <WebsiteFilterBar
          q={q}
          onQChange={setQ}
          tag={tag}
          folders={folders}
          activeFolderId={folderId}
          onSelectFolder={handleSelectFolder}
          contributors={contributors}
          activeSharedBy={sharedBy}
          onSelectUser={handleSelectUser}
          activeFilters={activeFilters}
          onClearAll={handleClearAll}
          session={session}
          onOpenForm={() => { setEditingWebsite(null); setFormOpen(true) }}
        />

        {!tag && items.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-1">
            <button type="button" onClick={() => setTagState("")} className="shrink-0 rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white transition-colors">全部</button>
            {Array.from(new Set(items.flatMap((item) => (Array.isArray(item.tags) ? item.tags : [])))).slice(0, 10).map((itemTag) => (
              <button key={itemTag} type="button" onClick={() => handleTagClick(itemTag)} className="shrink-0 whitespace-nowrap rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-500 shadow-sm ring-1 ring-slate-200 transition-colors hover:bg-blue-50 hover:text-blue-600">
                {itemTag}
              </button>
            ))}
          </div>
        )}

        {loading && items.length === 0 ? (
          <div className="grid grid-cols-1 gap-4 min-[360px]:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (<WebsiteCardSkeleton key={index} />))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            title={q || tag || folderId || sharedBy ? "没有找到相关网站" : "还没有人分享网站资源"}
            description={q || tag || folderId || sharedBy ? "试试其他关键词，或清空筛选条件。" : "成为第一个分享的人，把好用的网站放进社区资源库。"}
            action={(q || tag || folderId || sharedBy)
              ? { label: "清空筛选", onClick: handleClearAll }
              : session ? { label: "分享一个网站", onClick: () => { setEditingWebsite(null); setFormOpen(true) } } : undefined}
          />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 min-[360px]:grid-cols-2 xl:grid-cols-3">
              {items.map((resource) => (
                <WebsiteCard key={resource.id} resource={resource} onClick={() => setSelectedWebsiteId(resource.id)} onTagClick={handleTagClick} />
              ))}
            </div>
            {items.length < total && (
              <div className="flex justify-center">
                <Button variant="outline" size="sm" onClick={() => setPage((current) => current + 1)} disabled={loading}>
                  {loading ? "读取中..." : "加载更多"}
                </Button>
              </div>
            )}
          </>
        )}

        {stats && (stats.topVisited.length > 0 || stats.topContributors.length > 0) && (
          <ModulePanel title="社区统计" description="热门访问和贡献者会帮助资源库保持活跃。" icon={TrendingUp} contentClassName="space-y-5">
            <ModuleStatGrid className="lg:grid-cols-2">
              <StatsCard title="当前结果" value={total || items.length} unit="个" sub="匹配筛选条件" icon={TrendingUp} />
              <StatsCard title="贡献者" value={contributors.length} unit="人" sub="正在共同维护" icon={Users} tone="green" />
            </ModuleStatGrid>
            <div className="grid gap-4 sm:grid-cols-2">
              {stats.topVisited.length > 0 && (
                <div className="rounded-[18px] border border-slate-200 bg-slate-50/70 p-4">
                  <div className="mb-4 flex items-center gap-2">
                    <TrendingUp size={16} className="text-blue-600" />
                    <span className="text-sm font-semibold text-slate-900">热门访问</span>
                  </div>
                  <div className="space-y-2">
                    {stats.topVisited.map((item, index) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setSelectedWebsiteId(item.id)}
                        className="flex w-full items-center gap-3 rounded-[14px] p-2 text-left transition-colors hover:bg-white"
                      >
                        <span className="w-5 shrink-0 font-mono text-xs text-slate-400">#{index + 1}</span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-slate-900">{item.name}</p>
                          <p className="text-xs text-slate-400">{item.domain}</p>
                        </div>
                        <span className="shrink-0 text-xs text-slate-400">{item.visitCount} 次</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {stats.topContributors.length > 0 && (
                <div className="rounded-[18px] border border-slate-200 bg-slate-50/70 p-4">
                  <div className="mb-4 flex items-center gap-2">
                    <Users size={16} className="text-emerald-600" />
                    <span className="text-sm font-semibold text-slate-900">贡献排名</span>
                  </div>
                  <div className="space-y-2">
                    {stats.topContributors.map((item, index) => (
                      <button
                        key={item.user.id}
                        type="button"
                        onClick={() => { setSharedByState(item.user.id === sharedBy ? "" : item.user.id); setPage(1) }}
                        className="flex w-full items-center gap-3 rounded-[14px] p-2 text-left transition-colors hover:bg-white"
                      >
                        <span className="w-5 shrink-0 font-mono text-xs text-slate-400">#{index + 1}</span>
                        <UserAvatar size="sm" name={item.user.displayName || "用户"} email="" avatarText={item.user.avatarText} avatarUrl={item.user.avatarUrl} />
                        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900">{item.user.displayName || "用户"}</span>
                        <span className="shrink-0 text-xs text-slate-400">{item.websiteCount} 个</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </ModulePanel>
        )}

        {session && (
          <button
            type="button"
            onClick={() => { setEditingWebsite(null); setFormOpen(true) }}
            className="fixed bottom-20 right-4 z-40 inline-flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-white shadow-[0_12px_28px_rgba(37,99,235,0.35)] transition-transform hover:scale-105 active:scale-95 md:hidden"
            aria-label="分享网站"
            style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
          >
            <Plus size={22} />
          </button>
        )}
      </div>

      <WebsiteDetailSheet
        websiteId={selectedWebsiteId}
        onClose={() => setSelectedWebsiteId(null)}
        session={session}
        onEdit={(website) => { setSelectedWebsiteId(null); setEditingWebsite(website); setFormOpen(true) }}
        onDelete={handleDelete}
        onTagClick={handleTagClick}
        onFolderClick={handleSelectFolder}
        onUserClick={(userId) => { setSelectedWebsiteId(null); handleSelectUser(userId) }}
      />

      <WebsiteFormDialog
        open={formOpen}
        onOpenChange={(isOpen) => { setFormOpen(isOpen); if (!isOpen) setEditingWebsite(null) }}
        editingWebsite={editingWebsite}
        folders={folders}
        session={session}
        onSuccess={handleFormSuccess}
        onFolderCreated={refreshFolders}
      />

      <WebsiteFolderFormDialog
        open={folderFormOpen}
        onOpenChange={(isOpen) => { setFolderFormOpen(isOpen); if (!isOpen) setEditingFolder(null) }}
        editingFolder={editingFolder}
        onSuccess={handleFolderFormSuccess}
      />
    </div>
  )
}
