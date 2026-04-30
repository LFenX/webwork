"use client"

import { useCallback, useEffect, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Plus, TrendingUp, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { UserAvatar } from "@/components/user-avatar"
import { EmptyState } from "@/components/empty-state"
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
  initialItems, initialTotal, initialFolders, session, prefilledFolderId, folderInfo,
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

  // Fetch stats + contributors on mount
  useEffect(() => {
    fetch("/api/websites/stats", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        setStats(data)
        if (Array.isArray(data.contributors)) setContributors(data.contributors)
      })
      .catch(() => null)
  }, [])

  // Fetch data when filters change
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

  // Sync filters to URL
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
    params.set("page", "1"); params.set("size", "12")
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
    // Refresh stats
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
    setQ(""); setTagState("")
    if (!prefilledFolderId) setFolderId("")
    setSharedByState("")
    setPage(1)
  }, [prefilledFolderId])

  const handleCardClick = useCallback((resource: WebsiteResource) => {
    setSelectedWebsiteId(resource.id)
  }, [])

  const handleFormSuccess = useCallback(() => {
    setFormOpen(false); setEditingWebsite(null)
    refreshList(); refreshFolders()
  }, [refreshList, refreshFolders])

  const handleDelete = useCallback((websiteId: string) => {
    setSelectedWebsiteId(null)
    refreshList(); refreshFolders()
  }, [refreshList, refreshFolders])

  const handleFolderFormSuccess = useCallback(() => {
    setFolderFormOpen(false); setEditingFolder(null)
    refreshFolders()
  }, [refreshFolders])

  const activeFilters = [
    tag ? `标签: ${tag}` : "",
    folderId && !prefilledFolderId ? `文件夹: ${folders.find((f) => f.id === folderId)?.name || folderId}` : "",
    sharedBy ? `分享者: ${contributors.find((c) => c.id === sharedBy)?.displayName || sharedBy}` : "",
  ].filter(Boolean)

  return (
    <div className="flex flex-col lg:flex-row lg:gap-6">
      <WebsiteFolderSidebar
        folders={folders}
        activeFolderId={folderId}
        onSelectFolder={handleSelectFolder}
        session={session}
        onEditFolder={(folder) => { setEditingFolder(folder); setFolderFormOpen(true) }}
        onNewFolder={() => { setEditingFolder(null); setFolderFormOpen(true) }}
        onRefresh={refreshFolders}
      />

      <div className="flex-1 min-w-0">
        {folderInfo && (
          <div className="mb-6 rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface] p-5">
            <h1 className="text-xl font-semibold text-[--color-text-primary]">{folderInfo.name}</h1>
            {folderInfo.description && <p className="mt-1 text-sm text-[--color-text-secondary]">{folderInfo.description}</p>}
            <div className="mt-3 flex items-center gap-3 text-xs text-[--color-text-muted]">
              <div className="flex items-center gap-1.5">
                <UserAvatar size="sm" name={folderInfo.user.displayName || folderInfo.user.email} email={folderInfo.user.email} avatarText={folderInfo.user.avatarText} avatarUrl={folderInfo.user.avatarUrl} />
                <span>{folderInfo.user.displayName || folderInfo.user.email}</span>
              </div>
              <span>·</span>
              <span>{folderInfo._count.websites} 个网站</span>
            </div>
          </div>
        )}

        <WebsiteFilterBar
          q={q} onQChange={setQ} tag={tag}
          folders={folders} activeFolderId={folderId} onSelectFolder={handleSelectFolder}
          contributors={contributors} activeSharedBy={sharedBy} onSelectUser={handleSelectUser}
          activeFilters={activeFilters} onClearAll={handleClearAll}
          session={session}
          onOpenForm={() => { setEditingWebsite(null); setFormOpen(true) }}
        />

        {!tag && items.length > 0 && (
          <div className="mt-3 flex items-center gap-2 overflow-x-auto scrollbar-none pb-1">
            <button type="button" onClick={() => setTagState("")} className="shrink-0 rounded-full px-3 py-1 text-xs font-medium bg-[--color-brand] text-white transition-colors">全部</button>
            {Array.from(new Set(items.flatMap((i) => (Array.isArray(i.tags) ? i.tags : [])))).slice(0, 10).map((t) => (
              <button key={t} type="button" onClick={() => handleTagClick(t)} className="shrink-0 rounded-full bg-[--color-bg-hover] px-3 py-1 text-xs text-[--color-text-secondary] hover:bg-[--color-brand-soft] hover:text-[--color-brand] transition-colors whitespace-nowrap">{t}</button>
            ))}
          </div>
        )}

        {loading && items.length === 0 ? (
          <div className="mt-6 grid grid-cols-1 gap-4 min-[360px]:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (<WebsiteCardSkeleton key={i} />))}
          </div>
        ) : items.length === 0 ? (
          <div className="mt-10">
            <EmptyState
              title={q || tag || folderId || sharedBy ? "没有找到相关网站" : "还没有人分享网站资源"}
              description={q || tag || folderId || sharedBy ? "试试其他关键词，或清空筛选条件" : "成为第一个分享的人吧！"}
              action={(q || tag || folderId || sharedBy) ? { label: "清空筛选", onClick: handleClearAll } : session ? { label: "分享一个网站", onClick: () => { setEditingWebsite(null); setFormOpen(true) } } : undefined}
            />
          </div>
        ) : (
          <>
            <div className="mt-6 grid grid-cols-1 gap-4 min-[360px]:grid-cols-2 lg:grid-cols-3">
              {items.map((resource) => (
                <WebsiteCard key={resource.id} resource={resource} onClick={() => handleCardClick(resource)} onTagClick={handleTagClick} />
              ))}
            </div>
            {items.length < total && (
              <div className="mt-8 flex justify-center">
                <Button variant="outline" size="sm" onClick={() => setPage((p) => p + 1)} disabled={loading}>{loading ? "加载中..." : "加载更多"}</Button>
              </div>
            )}
          </>
        )}

        {/* Stats section */}
        {stats && (stats.topVisited.length > 0 || stats.topContributors.length > 0) && (
          <div className="mt-12">
            <h3 className="text-sm font-medium text-[--color-text-muted] mb-4">社区统计</h3>
            <div className="grid gap-6 sm:grid-cols-2">
              {/* Top visited */}
              {stats.topVisited.length > 0 && (
                <div className="rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface] p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <TrendingUp size={16} className="text-[--color-text-muted]" />
                    <span className="text-sm font-medium text-[--color-text-primary]">热门访问</span>
                  </div>
                  <div className="space-y-3">
                    {stats.topVisited.map((item, idx) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setSelectedWebsiteId(item.id)}
                        className="flex items-center gap-3 w-full text-left hover:bg-[--color-bg-hover] rounded-[--radius-sm] p-1.5 -mx-1.5 transition-colors"
                      >
                        <span className="text-xs font-mono text-[--color-text-muted] w-5 shrink-0">#{idx + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-[--color-text-primary] truncate">{item.name}</p>
                          <p className="text-xs text-[--color-text-muted]">{item.domain}</p>
                        </div>
                        <span className="text-xs text-[--color-text-muted] shrink-0">{item.visitCount} 次</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Top contributors */}
              {stats.topContributors.length > 0 && (
                <div className="rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface] p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <Users size={16} className="text-[--color-text-muted]" />
                    <span className="text-sm font-medium text-[--color-text-primary]">贡献排名</span>
                  </div>
                  <div className="space-y-3">
                    {stats.topContributors.map((item, idx) => (
                      <button
                        key={item.user.id}
                        type="button"
                        onClick={() => { setSharedByState(item.user.id === sharedBy ? "" : item.user.id); setPage(1) }}
                        className="flex items-center gap-3 w-full text-left hover:bg-[--color-bg-hover] rounded-[--radius-sm] p-1.5 -mx-1.5 transition-colors"
                      >
                        <span className="text-xs font-mono text-[--color-text-muted] w-5 shrink-0">#{idx + 1}</span>
                        <UserAvatar size="sm" name={item.user.displayName || "用户"} email="" avatarText={item.user.avatarText} avatarUrl={item.user.avatarUrl} />
                        <span className="flex-1 text-sm text-[--color-text-primary] truncate">{item.user.displayName || "用户"}</span>
                        <span className="text-xs text-[--color-text-muted] shrink-0">{item.websiteCount} 个</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Mobile FAB */}
        {session && (
          <button type="button" onClick={() => { setEditingWebsite(null); setFormOpen(true) }} className="fixed bottom-20 right-4 z-40 inline-flex h-12 w-12 items-center justify-center rounded-full bg-[--color-brand] text-white shadow-[0_8px_24px_rgba(37,99,235,0.35)] transition-transform hover:scale-105 active:scale-95 md:hidden" aria-label="分享网站" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
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
        onOpenChange={(open) => { setFormOpen(open); if (!open) setEditingWebsite(null) }}
        editingWebsite={editingWebsite}
        folders={folders}
        session={session}
        onSuccess={handleFormSuccess}
        onFolderCreated={refreshFolders}
      />

      <WebsiteFolderFormDialog
        open={folderFormOpen}
        onOpenChange={(open) => { setFolderFormOpen(open); if (!open) setEditingFolder(null) }}
        editingFolder={editingFolder}
        onSuccess={handleFolderFormSuccess}
      />
    </div>
  )
}
