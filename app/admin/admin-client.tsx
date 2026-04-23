"use client"

import { ChangeEvent, UIEvent, useEffect, useMemo, useState } from "react"
import { GitCommitHorizontal, Image as ImageIcon, KeyRound, RotateCcw, Save, ShieldCheck, Trash2, Upload, UserCheck, UserCog } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { apiDelete, apiFetch, apiPatch, apiPost } from "@/lib/api-client"
import { ADMIN_PERMISSION_DEFS, type AdminPermissionKey, type AdminPermissionMap } from "@/lib/admin-permissions"
import { formatChinaDateTime } from "@/lib/time"
import { AdminAIPanel } from "@/components/admin/admin-ai-panel"

type RegistrationRequest = {
  id: string
  email: string
  displayName: string
  status: string
  createdAt: string
}

type UserItem = {
  id: string
  email: string
  displayName: string
  role: string
  lastLoginAt: string | null
  createdAt: string
}

type AdminPermissionItem = {
  id: string
  email: string
  displayName: string
  role: string
  permissions: AdminPermissionMap
}

type PasswordChangeRequest = {
  id: string
  status: string
  requestedAt: string
  user: { id: string; email: string; displayName: string }
}

type Activity = {
  id: string
  action: string
  detail: string
  ipAddress: string
  geoLocation: string
  deviceInfo: string
  createdAt: string
  user: { email: string; displayName: string } | null
}

type UpdateLogItem = {
  hash: string
  date: string
  message: string
  originalMessage: string
  customMessage?: string | null
  useOriginal?: boolean
  hidden?: boolean
}

type AnnouncementItem = {
  id: string
  content: string
  source: string
  fromWorldChannel: boolean
  createdAt: string
  author: { id: string; email: string; displayName: string }
}

type BroadcastItem = {
  id: string
  content: string
  createdAt: string
  author: { id: string; email: string; displayName: string }
}

type StickerItem = {
  id: string
  name: string
  originalName: string
  url: string
}

type Overview = {
  currentAdmin: UserItem
  canManageUsers: boolean
  permissions: AdminPermissionMap
  requests: RegistrationRequest[]
  passwordRequests: PasswordChangeRequest[]
  updates: UpdateLogItem[]
}

type PageResult<T> = {
  items: T[]
  nextCursor: string | null
  hasMore: boolean
}

function formatTime(value: string | null) {
  if (!value) return "从未登录"
  return formatChinaDateTime(value)
}

function daysSince(value: string | null) {
  if (!value) return null
  return Math.floor((Date.now() - new Date(value).getTime()) / 86400000)
}

function formatActivityAction(action: string) {
  if (action === "login") return "登录"
  if (action === "logout") return "下线"
  if (action === "resume_online") return "回到 Web App"
  return action
}

function activityActionClass(action: string) {
  switch (action) {
    case "login":
      return "border-emerald-200 bg-emerald-50 text-emerald-700"
    case "logout":
      return "border-rose-200 bg-rose-50 text-rose-700"
    case "resume_online":
      return "border-sky-200 bg-sky-50 text-sky-700"
    default:
      return "border-amber-200 bg-amber-50 text-amber-700"
  }
}

function isNearBottom(event: UIEvent<HTMLDivElement>) {
  const target = event.currentTarget
  return target.scrollTop + target.clientHeight >= target.scrollHeight - 120
}

export function AdminClient() {
  const [data, setData] = useState<Overview | null>(null)
  const [users, setUsers] = useState<UserItem[]>([])
  const [activities, setActivities] = useState<Activity[]>([])
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([])
  const [broadcasts, setBroadcasts] = useState<BroadcastItem[]>([])
  const [stickers, setStickers] = useState<StickerItem[]>([])
  const [adminPermissions, setAdminPermissions] = useState<AdminPermissionItem[]>([])
  const [announcementDraft, setAnnouncementDraft] = useState("")
  const [usersCursor, setUsersCursor] = useState<string | null>(null)
  const [activitiesCursor, setActivitiesCursor] = useState<string | null>(null)
  const [usersHasMore, setUsersHasMore] = useState(false)
  const [activitiesHasMore, setActivitiesHasMore] = useState(false)
  const [usersLoading, setUsersLoading] = useState(false)
  const [activitiesLoading, setActivitiesLoading] = useState(false)
  const [activitiesRefreshedAt, setActivitiesRefreshedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  const [updateDrafts, setUpdateDrafts] = useState<Record<string, string>>({})
  const [geoRefreshing, setGeoRefreshing] = useState(false)
  const [announcementSaving, setAnnouncementSaving] = useState(false)
  const [stickerUploading, setStickerUploading] = useState(false)
  const [ownerTransferTargetId, setOwnerTransferTargetId] = useState<string>("")

  const hasPermission = (permission: AdminPermissionKey) => data?.permissions?.[permission] ?? false

  async function loadUsers(cursor: string | null, append: boolean) {
    setUsersLoading(true)
    try {
      const params = new URLSearchParams({ limit: "50" })
      if (cursor) params.set("cursor", cursor)
      const page = await apiFetch<PageResult<UserItem>>(`/api/admin/users?${params.toString()}`)
      setUsers((current) => append ? [...current, ...page.items] : page.items)
      setUsersCursor(page.nextCursor)
      setUsersHasMore(page.hasMore)
    } finally {
      setUsersLoading(false)
    }
  }

  async function loadActivities(cursor: string | null, append: boolean, silent = false) {
    if (!silent) setActivitiesLoading(true)
    try {
      const params = new URLSearchParams({ limit: "50" })
      if (cursor) params.set("cursor", cursor)
      const page = await apiFetch<PageResult<Activity>>(`/api/admin/activities?${params.toString()}`)
      setActivities((current) => append ? [...current, ...page.items] : page.items)
      setActivitiesCursor(page.nextCursor)
      setActivitiesHasMore(page.hasMore)
      if (!append) setActivitiesRefreshedAt(new Date().toISOString())
    } finally {
      if (!silent) setActivitiesLoading(false)
    }
  }

  async function loadAnnouncements() {
    const data = await apiFetch<{ items: AnnouncementItem[] }>("/api/announcements?history=1&limit=100")
    setAnnouncements(Array.isArray(data.items) ? data.items : [])
  }

  async function loadBroadcasts() {
    const data = await apiFetch<{ items: BroadcastItem[] }>("/api/world-broadcasts?limit=100")
    setBroadcasts(Array.isArray(data.items) ? data.items : [])
  }

  async function loadStickers() {
    const data = await apiFetch<{ items: StickerItem[] }>("/api/admin/stickers")
    setStickers(Array.isArray(data.items) ? data.items : [])
  }

  async function loadAdminPermissions() {
    const data = await apiFetch<{ items: AdminPermissionItem[] }>("/api/admin/permissions")
    setAdminPermissions(Array.isArray(data.items) ? data.items : [])
  }

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const overview = await apiFetch<Overview>("/api/admin/overview")
        if (cancelled) return
        setData(overview)
        await Promise.all([
          overview.permissions.manageUsers ? loadUsers(null, false) : Promise.resolve(setUsers([])),
          overview.permissions.viewActivityLogs ? loadActivities(null, false) : Promise.resolve(setActivities([])),
          overview.permissions.manageAnnouncements ? Promise.all([loadAnnouncements(), loadBroadcasts()]) : Promise.resolve(),
          overview.permissions.manageStickers ? loadStickers() : Promise.resolve(setStickers([])),
          overview.currentAdmin.role === "owner" ? loadAdminPermissions() : Promise.resolve(setAdminPermissions([])),
        ])
      } catch (error) {
        if (!cancelled) toast.error(error instanceof Error ? error.message : "加载失败")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [refreshKey])

  useEffect(() => {
    if (!data?.permissions?.viewActivityLogs) return

    const refreshLogs = () => {
      if (document.visibilityState !== "visible") return
      if (activitiesLoading) return
      void loadActivities(null, false, true)
    }
    const onRealtimeRefresh = () => refreshLogs()

    const interval = window.setInterval(refreshLogs, 30_000)
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") refreshLogs()
    }
    const onFocus = () => refreshLogs()

    document.addEventListener("visibilitychange", onVisibilityChange)
    window.addEventListener("focus", onFocus)
    window.addEventListener("admin-activities-refresh", onRealtimeRefresh)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener("visibilitychange", onVisibilityChange)
      window.removeEventListener("focus", onFocus)
      window.removeEventListener("admin-activities-refresh", onRealtimeRefresh)
    }
  }, [activitiesLoading, data?.permissions?.viewActivityLogs])

  const stats = useMemo(() => ({
    users: users.length,
    admins: users.filter((user) => user.role === "admin" || user.role === "owner").length,
    pending: (data?.requests.length ?? 0) + (data?.passwordRequests.length ?? 0),
  }), [data, users])

  const ownerTransferCandidates = users.filter((user) => user.id !== data?.currentAdmin.id && user.role !== "owner")
  const effectiveOwnerTransferTargetId =
    ownerTransferCandidates.some((user) => user.id === ownerTransferTargetId)
      ? ownerTransferTargetId
      : (ownerTransferCandidates[0]?.id ?? "")
  const selectedOwnerTransferUser =
    ownerTransferCandidates.find((user) => user.id === effectiveOwnerTransferTargetId) ?? null

  async function approve(id: string) {
    await apiPost(`/api/admin/registrations/${id}/approve`, {})
    toast.success("已同意注册申请")
    setRefreshKey((key) => key + 1)
  }

  async function approvePassword(id: string) {
    await apiPost(`/api/admin/password-requests/${id}/approve`, {})
    toast.success("已同意密码修改申请")
    setRefreshKey((key) => key + 1)
  }

  async function updateRole(id: string, role: string) {
    await apiPatch(`/api/admin/users/${id}/role`, { role })
    toast.success("成员权限已更新")
    setRefreshKey((key) => key + 1)
  }

  async function transferOwner(user: UserItem) {
    if (!confirm(`确认将终极管理员身份转让给 ${user.email} 吗？转让后你会变为普通管理员，但保留全部管理员权限。`)) return
    try {
      await apiPost(`/api/admin/users/${user.id}/transfer-owner`, {})
      toast.success("终极管理员身份已完成转让")
      setRefreshKey((key) => key + 1)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "转让失败")
    }
  }

  async function updateAdminPermission(admin: AdminPermissionItem, key: AdminPermissionKey, value: boolean) {
    const permissions = { ...admin.permissions, [key]: value }
    setAdminPermissions((items) => items.map((item) => item.id === admin.id ? { ...item, permissions } : item))
    try {
      const updated = await apiPatch<AdminPermissionItem>(`/api/admin/permissions/${admin.id}`, { permissions })
      setAdminPermissions((items) => items.map((item) => item.id === admin.id ? { ...item, permissions: updated.permissions } : item))
      toast.success("管理员权限已更新")
    } catch (error) {
      setAdminPermissions((items) => items.map((item) => item.id === admin.id ? admin : item))
      toast.error(error instanceof Error ? error.message : "权限更新失败")
    }
  }

  async function deleteUser(user: UserItem) {
    if (!confirm(`确认删除 ${user.email}？只有 30 天未登录用户才能删除。`)) return
    try {
      await apiDelete(`/api/admin/users/${user.id}`)
      toast.success("用户已删除")
      setRefreshKey((key) => key + 1)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "删除失败")
    }
  }

  function getDeleteBlockedReason(user: UserItem, inactiveDays: number | null) {
    if (!data) return "Temporarily unavailable"
    if (user.id === data.currentAdmin.id) return "Cannot delete yourself"
    if (user.role === "owner") return "Cannot delete the owner"
    if (inactiveDays === null) return "Never logged in"
    if (inactiveDays < 30) return `${30 - inactiveDays} days remaining`
    return null
  }
  async function saveUpdateLog(item: UpdateLogItem) {
    const customMessage = updateDrafts[item.hash] ?? item.customMessage ?? item.originalMessage
    await apiPatch(`/api/admin/updates/${item.hash}`, { customMessage, useOriginal: false, hidden: false })
    toast.success("更新日志已改为展示修改内容")
    setRefreshKey((key) => key + 1)
  }

  async function resetUpdateLog(item: UpdateLogItem) {
    await apiPatch(`/api/admin/updates/${item.hash}`, { useOriginal: true, hidden: false })
    toast.success("已恢复展示原始 commit 备注")
    setRefreshKey((key) => key + 1)
  }

  async function hideUpdateLog(item: UpdateLogItem) {
    if (!confirm(`确认从展示列表删除这条更新？\n${item.message}`)) return
    await apiDelete(`/api/admin/updates/${item.hash}`)
    toast.success("这条更新已从公开更新日志隐藏")
    setRefreshKey((key) => key + 1)
  }

  async function refreshGeoLocations() {
    setGeoRefreshing(true)
    try {
      const result = await apiPost<{ scanned: number; updated: number; failed: number; skipped: number }>(
        "/api/admin/activities/refresh-geo",
        {}
      )
      toast.success(`已更新 ${result.updated} 条地理位置，失败 ${result.failed} 条`)
      await loadActivities(null, false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "更新 IP 地理位置失败")
    } finally {
      setGeoRefreshing(false)
    }
  }

  async function publishAnnouncement() {
    const content = announcementDraft.trim()
    if (!content) return
    setAnnouncementSaving(true)
    try {
      await apiPost("/api/announcements", { content })
      toast.success("公告已发布")
      setAnnouncementDraft("")
      await loadAnnouncements()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "发布公告失败")
    } finally {
      setAnnouncementSaving(false)
    }
  }

  async function deleteAnnouncement(item: AnnouncementItem) {
    if (!confirm(`确认删除这条公告？\n${item.content}`)) return
    try {
      await apiDelete(`/api/announcements/${item.id}`)
      toast.success("公告已删除")
      await loadAnnouncements()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "删除公告失败")
    }
  }

  async function deleteBroadcast(item: BroadcastItem) {
    if (!confirm(`确认删除这条世界频道广播？\n${item.content}`)) return
    await apiDelete(`/api/world-broadcasts/${item.id}`)
    toast.success("广播历史已删除")
    await loadBroadcasts()
  }

  async function uploadPublicStickers(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])
    event.currentTarget.value = ""
    if (files.length === 0) return
    setStickerUploading(true)
    try {
      const form = new FormData()
      files.forEach((file) => form.append("files", file))
      const res = await fetch("/api/admin/stickers", { method: "POST", body: form })
      if (!res.ok) throw new Error("上传失败")
      toast.success("公用表情包已上传")
      await loadStickers()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "上传失败")
    } finally {
      setStickerUploading(false)
    }
  }

  async function deletePublicSticker(item: StickerItem) {
    await apiDelete(`/api/admin/stickers/${item.id}`)
    toast.success("表情包已删除")
    await loadStickers()
  }

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-10">
      <div className="mb-8">
        <h1 className="mb-1 text-xl font-semibold">管理员控制台</h1>
        <p className="text-sm text-[--color-text-muted]">审核注册、管理成员权限，并查看近期登录和操作行为。</p>
      </div>

      <div className="mb-8 grid grid-cols-3 gap-3">
        <div className="rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface] p-4">
          <p className="mb-2 text-xs text-[--color-text-muted]">待审核</p>
          <p className="text-2xl font-semibold">{stats.pending}</p>
        </div>
        <div className="rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface] p-4">
          <p className="mb-2 text-xs text-[--color-text-muted]">已加载成员</p>
          <p className="text-2xl font-semibold">{stats.users}{usersHasMore ? "+" : ""}</p>
        </div>
        <div className="rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface] p-4">
          <p className="mb-2 text-xs text-[--color-text-muted]">已加载管理员</p>
          <p className="text-2xl font-semibold">{stats.admins}</p>
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm text-[--color-text-muted]">加载中...</div>
      ) : data && (
        <div className="space-y-8">
          <AdminAIPanel enabled={hasPermission("manageAI")} />

          {data.currentAdmin.role === "owner" && (
            <section>
              <div className="mb-3 flex items-center gap-2">
                <ShieldCheck size={16} />
                <h2 className="text-sm font-semibold">管理员权限配置</h2>
              </div>
              <div className="mb-3 rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface] p-3">
                <p className="text-sm font-medium">终极管理员转让</p>
                <p className="mt-1 text-xs text-[--color-text-muted]">
                  转让后，当前终极管理员会降级为普通管理员，但自动保留全部管理员权限。
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Select value={effectiveOwnerTransferTargetId} onValueChange={setOwnerTransferTargetId} disabled={ownerTransferCandidates.length === 0}>
                    <SelectTrigger className="h-9 w-[280px] text-xs">
                      <SelectValue placeholder="选择新的终极管理员" />
                    </SelectTrigger>
                    <SelectContent>
                      {ownerTransferCandidates.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.displayName || user.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => selectedOwnerTransferUser && transferOwner(selectedOwnerTransferUser)}
                    disabled={!selectedOwnerTransferUser}
                  >
                    转让终极管理员
                  </Button>
                </div>
              </div>
              <div className="space-y-3 rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface] p-3">
                {adminPermissions.length === 0 ? (
                  <p className="p-2 text-sm text-[--color-text-muted]">暂无普通管理员</p>
                ) : adminPermissions.map((admin) => (
                  <div key={admin.id} className="rounded-[--radius-md] border border-[--color-border] p-3">
                    <div className="mb-3 min-w-0">
                      <p className="truncate text-sm font-medium">{admin.displayName || admin.email}</p>
                      <p className="truncate font-mono text-xs text-[--color-text-muted]">{admin.email}</p>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                      {ADMIN_PERMISSION_DEFS.map((permission) => (
                        <label key={permission.key} className="flex cursor-pointer items-start gap-2 rounded-[--radius-sm] border border-[--color-border] p-2 text-xs hover:bg-[--color-bg-hover]">
                          <input
                            type="checkbox"
                            checked={admin.permissions[permission.key]}
                            onChange={(event) => updateAdminPermission(admin, permission.key, event.target.checked)}
                            className="mt-0.5"
                          />
                          <span className="min-w-0">
                            <span className="block font-medium text-[--color-text-primary]">{permission.label}</span>
                            <span className="mt-0.5 block text-[--color-text-muted]">{permission.description}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {hasPermission("approveRegistrations") && (
          <section>
            <div className="mb-3 flex items-center gap-2">
              <UserCheck size={16} />
              <h2 className="text-sm font-semibold">注册审核</h2>
            </div>
            <div className="max-h-[320px] overflow-y-auto rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface]">
              {data.requests.length === 0 ? (
                <p className="p-4 text-sm text-[--color-text-muted]">暂无待审核申请</p>
              ) : data.requests.map((request) => (
                <div key={request.id} className="flex items-center gap-4 border-b border-[--color-border] px-4 py-3 last:border-b-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{request.displayName}</p>
                    <p className="break-all font-mono text-xs text-[--color-text-muted]">{request.email}</p>
                  </div>
                  <span className="text-xs text-[--color-text-muted]">{formatTime(request.createdAt)}</span>
                  <Button size="sm" onClick={() => approve(request.id)}>同意注册</Button>
                </div>
              ))}
            </div>
          </section>
          )}

          {hasPermission("approvePasswordChanges") && (
          <section>
            <div className="mb-3 flex items-center gap-2">
              <KeyRound size={16} />
              <h2 className="text-sm font-semibold">密码修改审核</h2>
            </div>
            <div className="max-h-[320px] overflow-y-auto rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface]">
              {data.passwordRequests.length === 0 ? (
                <p className="p-4 text-sm text-[--color-text-muted]">暂无待审核密码申请</p>
              ) : data.passwordRequests.map((request) => (
                <div key={request.id} className="flex items-center gap-4 border-b border-[--color-border] px-4 py-3 last:border-b-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{request.user.displayName || request.user.email}</p>
                    <p className="break-all font-mono text-xs text-[--color-text-muted]">{request.user.email}</p>
                  </div>
                  <span className="text-xs text-[--color-text-muted]">{formatTime(request.requestedAt)}</span>
                  <Button size="sm" onClick={() => approvePassword(request.id)}>同意修改</Button>
                </div>
              ))}
            </div>
          </section>
          )}

          {hasPermission("manageAnnouncements") && (
            <section>
              <div className="mb-3 flex items-center gap-2">
                <ShieldCheck size={16} />
                <h2 className="text-sm font-semibold">公告管理</h2>
              </div>
              <div className="rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface] p-4">
                <textarea
                  value={announcementDraft}
                  onChange={(event) => setAnnouncementDraft(event.target.value)}
                  maxLength={500}
                  placeholder="输入公告内容，最新公告会覆盖首页当前展示"
                  className="min-h-24 w-full rounded-[--radius-sm] border border-[--color-border] bg-[--color-bg-primary] p-2 text-sm outline-none focus:border-[--color-accent]"
                />
                <div className="mt-3 flex items-center justify-between">
                  <span className="font-mono text-xs text-[--color-text-muted]">{announcementDraft.length}/500</span>
                  <Button size="sm" onClick={publishAnnouncement} disabled={announcementSaving || !announcementDraft.trim()}>
                    {announcementSaving ? "发布中..." : "发布公告"}
                  </Button>
                </div>
              </div>
              <div className="mt-3 max-h-[420px] space-y-3 overflow-y-auto rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface] p-3">
                {announcements.length === 0 ? (
                  <p className="p-4 text-sm text-[--color-text-muted]">暂无历史公告</p>
                ) : announcements.map((item) => (
                  <div key={item.id} className="rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface] p-4">
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <p className="font-mono text-xs text-[--color-text-muted]">{formatTime(item.createdAt)} / {item.fromWorldChannel ? "世界频道" : "管理员"}</p>
                      <button type="button" onClick={() => deleteAnnouncement(item)} className="text-[--color-text-muted] hover:text-[--color-danger]" title="删除公告">
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <p className="whitespace-pre-wrap break-words text-sm">{item.content}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {hasPermission("manageAnnouncements") && (
            <section>
              <div className="mb-3 flex items-center gap-2">
                <ShieldCheck size={16} />
                <h2 className="text-sm font-semibold">世界频道广播历史</h2>
              </div>
              <div className="max-h-[420px] space-y-3 overflow-y-auto rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface] p-3">
                {broadcasts.length === 0 ? (
                  <p className="p-4 text-sm text-[--color-text-muted]">暂无广播历史</p>
                ) : broadcasts.map((item) => (
                  <div key={item.id} className="rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface] p-4">
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <p className="font-mono text-xs text-[--color-text-muted]">{formatTime(item.createdAt)} / {item.author.displayName || item.author.email}</p>
                      <button type="button" onClick={() => deleteBroadcast(item)} className="text-[--color-text-muted] hover:text-[--color-danger]" title="删除广播">
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <p className="whitespace-pre-wrap break-words text-sm">{item.content}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {hasPermission("manageStickers") && (
            <section>
              <div className="mb-3 flex items-center gap-2">
                <ImageIcon size={16} />
                <h2 className="text-sm font-semibold">公用表情包库</h2>
              </div>
              <div className="rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface] p-4">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-[--radius-sm] border border-[--color-border] px-3 py-2 text-sm hover:bg-[--color-bg-hover]">
                  <Upload size={14} />
                  {stickerUploading ? "上传中..." : "批量上传公用表情包"}
                  <input type="file" accept="image/*" multiple className="hidden" onChange={uploadPublicStickers} disabled={stickerUploading} />
                </label>
                <div className="mt-4 grid max-h-[360px] grid-cols-4 gap-3 overflow-y-auto pr-1 sm:grid-cols-8">
                  {stickers.map((item) => (
                    <div key={item.id} className="group relative flex aspect-square items-center justify-center overflow-hidden rounded border border-[--color-border] bg-white">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={item.url} alt={item.name || item.originalName} className="max-h-full max-w-full object-contain" />
                      <button type="button" onClick={() => deletePublicSticker(item)} className="absolute right-1 top-1 hidden rounded bg-white p-1 text-[--color-danger] shadow group-hover:block" title="删除">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {hasPermission("manageUsers") && (
          <section>
            <div className="mb-3 flex items-center gap-2">
              <UserCog size={16} />
              <h2 className="text-sm font-semibold">User Management</h2>
            </div>
            <div className="overflow-hidden rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface]">
              <div
                className="max-h-[470px] overflow-auto bg-[--color-bg-surface]"
                onScroll={(event) => {
                  if (isNearBottom(event) && usersHasMore && !usersLoading) void loadUsers(usersCursor, true)
                }}
              >
                <div className="min-w-[950px]">
                  <table className="w-full table-fixed border-separate border-spacing-0 bg-[--color-bg-surface] text-sm">
                    <thead className="sticky top-0 z-10">
                      <tr>
                        <th className="glass-nav-bg w-[290px] border-b-2 border-[--color-border-strong] px-4 py-2.5 text-left text-xs font-medium text-[--color-text-muted]">User</th>
                        <th className="glass-nav-bg w-[150px] border-b-2 border-[--color-border-strong] px-4 py-2.5 text-left text-xs font-medium text-[--color-text-muted]">Role</th>
                        <th className="glass-nav-bg w-[190px] border-b-2 border-[--color-border-strong] px-4 py-2.5 text-left text-xs font-medium text-[--color-text-muted]">Last Login</th>
                        <th className="glass-nav-bg w-[150px] border-b-2 border-[--color-border-strong] px-4 py-2.5 text-left text-xs font-medium text-[--color-text-muted]">Delete Rule</th>
                        {data.canManageUsers && <th className="glass-nav-bg w-[170px] border-b-2 border-[--color-border-strong] px-4 py-2.5" />}
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((user) => {
                        const inactiveDays = daysSince(user.lastLoginAt)
                        const deleteBlockedReason = getDeleteBlockedReason(user, inactiveDays)
                        const canEditRole =
                          data.canManageUsers &&
                          user.role !== "owner" &&
                          (data.currentAdmin.role === "owner" || user.role !== "admin")
                        const canTransferOwner =
                          data.currentAdmin.role === "owner" &&
                          user.id !== data.currentAdmin.id &&
                          user.role !== "owner"

                        return (
                          <tr key={user.id}>
                            <td className="w-[290px] border-b border-[--color-border] bg-[--color-bg-surface] px-4 py-3">
                              <p className="truncate font-medium">{user.displayName || user.email}</p>
                              <p className="truncate font-mono text-xs text-[--color-text-muted]">{user.email}</p>
                            </td>
                            <td className="w-[150px] border-b border-[--color-border] bg-[--color-bg-surface] px-4 py-3">
                              {canEditRole ? (
                                <Select value={user.role === "admin" ? "admin" : "user"} onValueChange={(role) => updateRole(user.id, role)}>
                                  <SelectTrigger className="h-8 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="user">User</SelectItem>
                                    <SelectItem value="admin">Admin</SelectItem>
                                  </SelectContent>
                                </Select>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-xs">
                                  {user.role === "owner" && <ShieldCheck size={13} />}
                                  {user.role === "owner" ? "Owner" : user.role === "admin" ? "Admin" : "User"}
                                </span>
                              )}
                            </td>
                            <td className="w-[190px] border-b border-[--color-border] bg-[--color-bg-surface] px-4 py-3 text-xs text-[--color-text-muted]">{formatTime(user.lastLoginAt)}</td>
                            <td className="w-[150px] border-b border-[--color-border] bg-[--color-bg-surface] px-4 py-3 text-xs text-[--color-text-muted]">
                              {deleteBlockedReason ?? "Deletable"}
                            </td>
                            {data.canManageUsers && (
                              <td className="w-[170px] border-b border-[--color-border] bg-[--color-bg-surface] px-4 py-3">
                                <div className="flex items-center justify-end gap-2">
                                  {canTransferOwner && (
                                    <Button size="sm" variant="outline" onClick={() => transferOwner(user)} className="h-8 px-2 text-xs">
                                      Transfer
                                    </Button>
                                  )}
                                  <button
                                    onClick={() => deleteUser(user)}
                                    disabled={Boolean(deleteBlockedReason)}
                                    className="p-1 text-[--color-text-muted] hover:text-[--color-danger] disabled:cursor-not-allowed disabled:opacity-40"
                                    title={deleteBlockedReason ?? "Delete user"}
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </td>
                            )}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                  {usersLoading && <p className="p-3 text-center text-xs text-[--color-text-muted]">Loading more users...</p>}
                </div>
              </div>
            </div>
          </section>
          )}
          {hasPermission("viewActivityLogs") && (
          <section>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <ShieldCheck size={16} />
                <h2 className="text-sm font-semibold">最近登录和操作行为</h2>
                <span className="text-xs text-[--color-text-muted]">
                  最近自动刷新：{activitiesRefreshedAt ? formatTime(activitiesRefreshedAt) : "尚未刷新"}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => void loadActivities(null, false)} disabled={activitiesLoading}>
                  <RotateCcw size={14} /> {activitiesLoading ? "刷新中..." : "刷新日志"}
                </Button>
                {hasPermission("refreshGeoLocations") && (
                  <Button size="sm" variant="outline" onClick={refreshGeoLocations} disabled={geoRefreshing}>
                    <RotateCcw size={14} /> {geoRefreshing ? "更新中..." : "更新 IP 地理位置"}
                  </Button>
                )}
              </div>
            </div>
            <div className="overflow-hidden rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface]">
              {activities.length === 0 ? (
                <p className="p-4 text-sm text-[--color-text-muted]">暂无行为记录</p>
              ) : (
                <div
                  className="max-h-[500px] overflow-auto bg-[--color-bg-surface]"
                  onScroll={(event) => {
                    if (isNearBottom(event) && activitiesHasMore && !activitiesLoading) void loadActivities(activitiesCursor, true)
                  }}
                >
                  <div className="min-w-[1080px]">
                    <table className="w-full table-fixed border-separate border-spacing-0 bg-[--color-bg-surface] text-sm">
                      <thead className="sticky top-0 z-10">
                        <tr>
                          <th className="glass-nav-bg w-[160px] border-b-2 border-[--color-border-strong] px-4 py-2.5 text-left text-xs font-medium text-[--color-text-muted]">时间</th>
                          <th className="glass-nav-bg w-[170px] border-b-2 border-[--color-border-strong] px-4 py-2.5 text-left text-xs font-medium text-[--color-text-muted]">行为</th>
                          <th className="glass-nav-bg w-[300px] border-b-2 border-[--color-border-strong] px-4 py-2.5 text-left text-xs font-medium text-[--color-text-muted]">用户与详情</th>
                          <th className="glass-nav-bg w-[180px] border-b-2 border-[--color-border-strong] px-4 py-2.5 text-left text-xs font-medium text-[--color-text-muted]">IP 地址</th>
                          <th className="glass-nav-bg w-[160px] border-b-2 border-[--color-border-strong] px-4 py-2.5 text-left text-xs font-medium text-[--color-text-muted]">地理位置</th>
                          <th className="glass-nav-bg w-[140px] border-b-2 border-[--color-border-strong] px-4 py-2.5 text-left text-xs font-medium text-[--color-text-muted]">设备信息</th>
                        </tr>
                      </thead>
                        <tbody>
                          {activities.map((activity) => (
                            <tr key={activity.id}>
                              <td className="w-[160px] border-b border-[--color-border] bg-[--color-bg-surface] px-4 py-3 text-xs text-[--color-text-muted]">{formatTime(activity.createdAt)}</td>
                              <td className="w-[170px] break-words border-b border-[--color-border] bg-[--color-bg-surface] px-4 py-3 text-xs"><span className={`inline-flex min-w-[72px] items-center justify-center rounded-full border px-2.5 py-1 font-mono ${activityActionClass(activity.action)}`}>{formatActivityAction(activity.action)}</span></td>
                              <td className="w-[300px] break-words border-b border-[--color-border] bg-[--color-bg-surface] px-4 py-3 text-xs text-[--color-text-muted]">
                                {(activity.user?.displayName || activity.user?.email || "系统")}：{activity.detail}
                              </td>
                              <td className="w-[180px] break-all border-b border-[--color-border] bg-[--color-bg-surface] px-4 py-3 font-mono text-xs text-[--color-text-muted]">{activity.ipAddress || "未知"}</td>
                              <td className="w-[160px] break-words border-b border-[--color-border] bg-[--color-bg-surface] px-4 py-3 text-xs text-[--color-text-muted]">{activity.geoLocation || "未知"}</td>
                              <td className="w-[140px] break-words border-b border-[--color-border] bg-[--color-bg-surface] px-4 py-3 text-xs text-[--color-text-muted]">{activity.deviceInfo || "未知"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {activitiesLoading && <p className="p-3 text-center text-xs text-[--color-text-muted]">加载更多日志...</p>}
                  </div>
                </div>
              )}
            </div>
          </section>
          )}

          {hasPermission("manageUpdateLogs") && (
            <section>
              <div className="mb-3 flex items-center gap-2">
                <GitCommitHorizontal size={16} />
                <h2 className="text-sm font-semibold">更新日志展示管理</h2>
              </div>
              <div className="max-h-[520px] space-y-3 overflow-y-auto rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface] p-3">
                {data.updates.length === 0 ? (
                  <p className="p-4 text-sm text-[--color-text-muted]">暂无 Git 更新记录</p>
                ) : data.updates.map((item) => (
                  <div key={item.hash} className={`rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface] p-4 ${item.hidden ? "opacity-55" : ""}`}>
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-mono text-xs text-[--color-text-muted]">{formatTime(item.date)} - {item.hash.slice(0, 12)}</p>
                        <p className="mt-1 text-xs text-[--color-text-muted]">原始备注：{item.originalMessage}</p>
                      </div>
                      <span className="text-xs text-[--color-text-muted]">
                        {item.hidden ? "已隐藏" : item.useOriginal ? "展示原始内容" : "展示修改内容"}
                      </span>
                    </div>
                    <textarea
                      value={updateDrafts[item.hash] ?? item.customMessage ?? item.originalMessage}
                      onChange={(event) => setUpdateDrafts((drafts) => ({ ...drafts, [item.hash]: event.target.value }))}
                      className="min-h-20 w-full rounded-[--radius-sm] border border-[--color-border-strong] bg-[--color-bg-primary] p-2 text-sm outline-none focus:border-[--color-text-primary]"
                    />
                    <div className="mt-3 flex flex-wrap justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => saveUpdateLog(item)}><Save size={14} /> 保存修改展示</Button>
                      <Button size="sm" variant="outline" onClick={() => resetUpdateLog(item)}><RotateCcw size={14} /> 展示原始内容</Button>
                      <Button size="sm" variant="outline" onClick={() => hideUpdateLog(item)} className="text-[--color-danger]"><Trash2 size={14} /> 删除展示</Button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
