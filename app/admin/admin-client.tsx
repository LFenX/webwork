"use client"

import { ChangeEvent, UIEvent, useEffect, useMemo, useState } from "react"
import {
  GitCommitHorizontal,
  Image as ImageIcon,
  KeyRound,
  RotateCcw,
  Save,
  ShieldCheck,
  Trash2,
  Upload,
  UserCheck,
  UserCog,
} from "lucide-react"
import { toast } from "sonner"
import { AdminAIPanel } from "@/components/admin/admin-ai-panel"
import { AdminAIUsagePanel } from "@/components/admin/admin-ai-usage-panel"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { apiDelete, apiFetch, apiPatch, apiPost } from "@/lib/api-client"
import { ADMIN_PERMISSION_DEFS, type AdminPermissionKey, type AdminPermissionMap } from "@/lib/admin-permissions"
import { getDict } from "@/lib/i18n"
import { confirmAction, safeErrorMessage } from "@/lib/interaction-feedback"
import { formatChinaDateTime } from "@/lib/time"

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

function formatTime(value: string | null, dict: ReturnType<typeof getDict>) {
  if (!value) return dict.admin.neverLoggedIn
  return formatChinaDateTime(value)
}

function daysSince(value: string | null) {
  if (!value) return null
  return Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000)
}

function formatActivityAction(action: string) {
  if (action === "login") return "Login"
  if (action === "logout") return "Logout"
  if (action === "resume_online") return "Back to app"
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
  const dict = getDict()
  const d = dict.admin

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
  const [ownerTransferTargetId, setOwnerTransferTargetId] = useState("")
  const [selectedAdminPermissionId, setSelectedAdminPermissionId] = useState<string | null>(null)
  const [busyActions, setBusyActions] = useState<Record<string, boolean>>({})

  const hasPermission = (permission: AdminPermissionKey) => data?.permissions?.[permission] ?? false
  const isBusy = (key: string) => Boolean(busyActions[key])
  const runAdminAction = async (key: string, loadingMessage: string, action: () => Promise<void>) => {
    if (isBusy(key)) return
    const toastId = toast.loading(loadingMessage)
    setBusyActions((current) => ({ ...current, [key]: true }))
    try {
      await action()
      toast.dismiss(toastId)
    } catch (error) {
      toast.error(safeErrorMessage(error, d.failedToLoad), { id: toastId })
    } finally {
      setBusyActions((current) => {
        const next = { ...current }
        delete next[key]
        return next
      })
    }
  }

  async function loadUsers(cursor: string | null, append: boolean) {
    setUsersLoading(true)
    try {
      const params = new URLSearchParams({ limit: "50" })
      if (cursor) params.set("cursor", cursor)
      const page = await apiFetch<PageResult<UserItem>>(`/api/admin/users?${params.toString()}`)
      setUsers((current) => (append ? [...current, ...page.items] : page.items))
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
      setActivities((current) => (append ? [...current, ...page.items] : page.items))
      setActivitiesCursor(page.nextCursor)
      setActivitiesHasMore(page.hasMore)
      if (!append) setActivitiesRefreshedAt(new Date().toISOString())
    } finally {
      if (!silent) setActivitiesLoading(false)
    }
  }

  async function loadAnnouncements() {
    const response = await apiFetch<{ items: AnnouncementItem[] }>("/api/announcements?history=1&limit=100")
    setAnnouncements(Array.isArray(response.items) ? response.items : [])
  }

  async function loadBroadcasts() {
    const response = await apiFetch<{ items: BroadcastItem[] }>("/api/world-broadcasts?limit=100")
    setBroadcasts(Array.isArray(response.items) ? response.items : [])
  }

  async function loadStickers() {
    const response = await apiFetch<{ items: StickerItem[] }>("/api/admin/stickers")
    setStickers(Array.isArray(response.items) ? response.items : [])
  }

  async function loadAdminPermissions() {
    const response = await apiFetch<{ items: AdminPermissionItem[] }>("/api/admin/permissions")
    setAdminPermissions(Array.isArray(response.items) ? response.items : [])
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
        if (!cancelled) {
          toast.error(error instanceof Error ? error.message : d.failedToLoad)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
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

    const interval = window.setInterval(refreshLogs, 30_000)
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") refreshLogs()
    }
    const onFocus = () => refreshLogs()
    const onRealtimeRefresh = () => refreshLogs()

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

  const stats = useMemo(
    () => ({
      users: users.length,
      admins: users.filter((user) => user.role === "admin" || user.role === "owner").length,
      pending: (data?.requests.length ?? 0) + (data?.passwordRequests.length ?? 0),
    }),
    [data, users]
  )

  const ownerTransferCandidates = users.filter((user) => user.id !== data?.currentAdmin.id && user.role !== "owner")
  const effectiveOwnerTransferTargetId = ownerTransferCandidates.some((user) => user.id === ownerTransferTargetId)
    ? ownerTransferTargetId
    : (ownerTransferCandidates[0]?.id ?? "")
  const selectedOwnerTransferUser =
    ownerTransferCandidates.find((user) => user.id === effectiveOwnerTransferTargetId) ?? null
  const selectedAdminPermission =
    adminPermissions.find((item) => item.id === selectedAdminPermissionId) ?? null

  async function approve(id: string) {
    await runAdminAction(`approve:${id}`, "Approving registration...", async () => {
      await apiPost(`/api/admin/registrations/${id}/approve`, {})
      toast.success(d.approved)
      setRefreshKey((key) => key + 1)
    })
  }

  async function approvePassword(id: string) {
    await runAdminAction(`approve-password:${id}`, "Approving password change...", async () => {
      await apiPost(`/api/admin/password-requests/${id}/approve`, {})
      toast.success("Password change approved")
      setRefreshKey((key) => key + 1)
    })
  }

  async function updateRole(id: string, role: string) {
    await runAdminAction(`role:${id}`, "Updating role...", async () => {
      await apiPatch(`/api/admin/users/${id}/role`, { role })
      toast.success(d.roleUpdated)
      setRefreshKey((key) => key + 1)
    })
  }

  async function transferOwner(user: UserItem) {
    if (!confirmAction(`Transfer ownership to ${user.email}? You will remain an admin with full admin permissions.`)) {
      return
    }
    await runAdminAction(`transfer-owner:${user.id}`, "Transferring ownership...", async () => {
      await apiPost(`/api/admin/users/${user.id}/transfer-owner`, {})
      toast.success(d.ownershipTransferred)
      setRefreshKey((key) => key + 1)
    })
  }

  async function updateAdminPermission(admin: AdminPermissionItem, key: AdminPermissionKey, value: boolean) {
    const permissions = { ...admin.permissions, [key]: value }
    setAdminPermissions((items) => items.map((item) => (item.id === admin.id ? { ...item, permissions } : item)))
    try {
      const updated = await apiPatch<AdminPermissionItem>(`/api/admin/permissions/${admin.id}`, { permissions })
      setAdminPermissions((items) =>
        items.map((item) => (item.id === admin.id ? { ...item, permissions: updated.permissions } : item))
      )
      toast.success(d.permissionsUpdated)
    } catch (error) {
      setAdminPermissions((items) => items.map((item) => (item.id === admin.id ? admin : item)))
      toast.error(error instanceof Error ? error.message : "Failed to update permissions")
    }
  }

  async function deleteUser(user: UserItem) {
    if (!confirmAction(`Delete ${user.email}? Only users inactive for at least 30 days can be deleted. This removes the account and cannot be undone.`)) return
    await runAdminAction(`delete-user:${user.id}`, "Deleting user...", async () => {
      await apiDelete(`/api/admin/users/${user.id}`)
      toast.success(d.userDeleted)
      setRefreshKey((key) => key + 1)
    })
  }

  function getDeleteBlockedReason(user: UserItem, inactiveDays: number | null) {
    if (!data) return "Temporarily unavailable"
    if (user.id === data.currentAdmin.id) return d.deleteBlocked.self
    if (user.role === "owner") return d.deleteBlocked.owner
    if (inactiveDays === null) return d.deleteBlocked.neverLogin
    if (inactiveDays < 30) return d.deleteBlocked.daysRemaining(30 - inactiveDays)
    return null
  }

  async function saveUpdateLog(item: UpdateLogItem) {
    const customMessage = updateDrafts[item.hash] ?? item.customMessage ?? item.originalMessage
    await runAdminAction(`update-log:${item.hash}`, "Saving update log...", async () => {
      await apiPatch(`/api/admin/updates/${item.hash}`, { customMessage, useOriginal: false, hidden: false })
      toast.success(d.updateLogSaved)
      setRefreshKey((key) => key + 1)
    })
  }

  async function resetUpdateLog(item: UpdateLogItem) {
    if (!confirmAction(`Restore this changelog item to the original commit message?\n${item.originalMessage}`)) return
    await runAdminAction(`reset-log:${item.hash}`, "Restoring update log...", async () => {
      await apiPatch(`/api/admin/updates/${item.hash}`, { useOriginal: true, hidden: false })
      toast.success(d.originalRestored)
      setRefreshKey((key) => key + 1)
    })
  }

  async function hideUpdateLog(item: UpdateLogItem) {
    if (!confirmAction(`Hide this update from the public changelog?\n${item.message}`)) return
    await runAdminAction(`hide-log:${item.hash}`, "Hiding update log...", async () => {
      await apiDelete(`/api/admin/updates/${item.hash}`)
      toast.success(d.updateHidden)
      setRefreshKey((key) => key + 1)
    })
  }

  async function refreshGeoLocations() {
    setGeoRefreshing(true)
    try {
      const result = await apiPost<{ scanned: number; updated: number; failed: number; skipped: number }>(
        "/api/admin/activities/refresh-geo",
        {}
      )
      toast.success(d.geoRefreshed(result.updated, result.failed))
      await loadActivities(null, false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to refresh geo locations")
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
      toast.success(d.announcementPublished)
      setAnnouncementDraft("")
      await loadAnnouncements()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to publish announcement")
    } finally {
      setAnnouncementSaving(false)
    }
  }

  async function deleteAnnouncement(item: AnnouncementItem) {
    if (!confirmAction(`Delete this announcement? It will disappear from the announcement history.\n${item.content}`)) return
    await runAdminAction(`delete-announcement:${item.id}`, "Deleting announcement...", async () => {
      await apiDelete(`/api/announcements/${item.id}`)
      toast.success(d.announcementDeleted)
      await loadAnnouncements()
    })
  }

  async function deleteBroadcast(item: BroadcastItem) {
    if (!confirmAction(`Delete this broadcast? It will be removed from the world channel history.\n${item.content}`)) return
    await runAdminAction(`delete-broadcast:${item.id}`, "Deleting broadcast...", async () => {
      await apiDelete(`/api/world-broadcasts/${item.id}`)
      toast.success(d.broadcastDeleted)
      await loadBroadcasts()
    })
  }

  async function uploadPublicStickers(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])
    event.currentTarget.value = ""
    if (files.length === 0) return
    setStickerUploading(true)
    try {
      const form = new FormData()
      files.forEach((file) => form.append("files", file))
      const response = await fetch("/api/admin/stickers", { method: "POST", body: form })
      if (!response.ok) throw new Error("Upload failed")
      toast.success(d.stickersUploaded)
      await loadStickers()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed")
    } finally {
      setStickerUploading(false)
    }
  }

  async function deletePublicSticker(item: StickerItem) {
    if (!confirmAction(`Delete public sticker "${item.name || item.originalName}"? It will no longer be available in the public sticker library.`)) return
    await runAdminAction(`delete-sticker:${item.id}`, "Deleting sticker...", async () => {
      await apiDelete(`/api/admin/stickers/${item.id}`)
      toast.success(d.stickerDeleted)
      await loadStickers()
    })
  }

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-10">
      <div className="mb-8">
        <h1 className="mb-1 text-xl font-semibold">{d.title}</h1>
        <p className="text-sm text-[--color-text-muted]">{d.description}</p>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface] p-4">
          <p className="mb-2 text-xs text-[--color-text-muted]">{d.pendingApprovals}</p>
          <p className="text-2xl font-semibold">{stats.pending}</p>
        </div>
        <div className="rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface] p-4">
          <p className="mb-2 text-xs text-[--color-text-muted]">{d.loadedUsers}</p>
          <p className="text-2xl font-semibold">
            {stats.users}
            {usersHasMore ? "+" : ""}
          </p>
        </div>
        <div className="rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface] p-4">
          <p className="mb-2 text-xs text-[--color-text-muted]">{d.admins}</p>
          <p className="text-2xl font-semibold">{stats.admins}</p>
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm text-[--color-text-muted]">{d.loading}</div>
      ) : data ? (
        <div className="space-y-8">
          <AdminAIPanel enabled={hasPermission("manageAI")} />

          <AdminAIUsagePanel enabled={hasPermission("manageAI")} />

          {data.currentAdmin.role === "owner" ? (
            <section>
              <div className="mb-3 flex items-center gap-2">
                <ShieldCheck size={16} />
                <h2 className="text-sm font-semibold">{d.adminPermissions}</h2>
              </div>

              <div className="mb-3 rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface] p-4">
                <p className="text-sm font-medium">{d.transferOwnership}</p>
                <p className="mt-1 text-xs text-[--color-text-muted]">
                  {d.transferOwnerDesc}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Select
                    value={effectiveOwnerTransferTargetId}
                    onValueChange={setOwnerTransferTargetId}
                    disabled={ownerTransferCandidates.length === 0}
                  >
                    <SelectTrigger className="h-9 w-[280px] text-xs">
                      <SelectValue placeholder={d.selectNewOwner} />
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
                    loading={selectedOwnerTransferUser ? isBusy(`transfer-owner:${selectedOwnerTransferUser.id}`) : false}
                    loadingText="Transferring..."
                  >
                    {d.transferOwner}
                  </Button>
                </div>
              </div>

              <div className="rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface] p-4">
                {adminPermissions.length === 0 ? (
                  <p className="text-sm text-[--color-text-muted]">{d.noExtraAdmins}</p>
                ) : (
                  <>
                    <p className="mb-3 text-sm font-medium">{d.chooseAdminEdit}</p>
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {adminPermissions.map((admin) => (
                        <button
                          key={admin.id}
                          type="button"
                          onClick={() => setSelectedAdminPermissionId(admin.id)}
                          className="rounded-[--radius-md] border border-[--color-border] p-4 text-left transition hover:border-[--color-border-strong] hover:bg-[--color-bg-hover]"
                        >
                          <p className="truncate text-sm font-medium">{admin.displayName || admin.email}</p>
                          <p className="mt-1 truncate font-mono text-xs text-[--color-text-muted]">{admin.email}</p>
                          <p className="mt-3 text-xs text-[--color-text-muted]">
                            {d.permissionsEnabled(ADMIN_PERMISSION_DEFS.filter((permission) => admin.permissions[permission.key]).length)}
                          </p>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </section>
          ) : null}

          {hasPermission("approveRegistrations") ? (
            <section>
              <div className="mb-3 flex items-center gap-2">
                <UserCheck size={16} />
                <h2 className="text-sm font-semibold">{d.registrationApprovals}</h2>
              </div>
              <div className="max-h-[320px] overflow-y-auto rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface]">
                {data.requests.length === 0 ? (
                  <p className="p-4 text-sm text-[--color-text-muted]">{d.noRegistrationRequests}</p>
                ) : (
                  data.requests.map((request) => (
                    <div key={request.id} className="flex items-center gap-4 border-b border-[--color-border] px-4 py-3 last:border-b-0">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{request.displayName}</p>
                        <p className="break-all font-mono text-xs text-[--color-text-muted]">{request.email}</p>
                      </div>
                      <span className="text-xs text-[--color-text-muted]">{formatTime(request.createdAt, dict)}</span>
                      <Button size="sm" onClick={() => approve(request.id)} loading={isBusy(`approve:${request.id}`)} loadingText={d.approve}>
                        {d.approve}
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </section>
          ) : null}

          {hasPermission("approvePasswordChanges") ? (
            <section>
              <div className="mb-3 flex items-center gap-2">
                <KeyRound size={16} />
                <h2 className="text-sm font-semibold">{d.passwordApprovals}</h2>
              </div>
              <div className="max-h-[320px] overflow-y-auto rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface]">
                {data.passwordRequests.length === 0 ? (
                  <p className="p-4 text-sm text-[--color-text-muted]">{d.noPasswordRequests}</p>
                ) : (
                  data.passwordRequests.map((request) => (
                    <div key={request.id} className="flex items-center gap-4 border-b border-[--color-border] px-4 py-3 last:border-b-0">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{request.user.displayName || request.user.email}</p>
                        <p className="break-all font-mono text-xs text-[--color-text-muted]">{request.user.email}</p>
                      </div>
                      <span className="text-xs text-[--color-text-muted]">{formatTime(request.requestedAt, dict)}</span>
                      <Button size="sm" onClick={() => approvePassword(request.id)} loading={isBusy(`approve-password:${request.id}`)} loadingText={d.approve}>
                        {d.approve}
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </section>
          ) : null}

          {hasPermission("manageAnnouncements") ? (
            <section>
              <div className="mb-3 flex items-center gap-2">
                <ShieldCheck size={16} />
                <h2 className="text-sm font-semibold">{d.announcements}</h2>
              </div>
              <div className="rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface] p-4">
                <textarea
                  value={announcementDraft}
                  onChange={(event) => setAnnouncementDraft(event.target.value)}
                  maxLength={500}
                  placeholder={d.announcementPlaceholder}
                  className="min-h-24 w-full rounded-[--radius-sm] border border-[--color-border] bg-[--color-bg-primary] p-2 text-sm outline-none focus:border-[--color-accent]"
                />
                <div className="mt-3 flex items-center justify-between">
                  <span className="font-mono text-xs text-[--color-text-muted]">{announcementDraft.length}/500</span>
                  <Button size="sm" onClick={publishAnnouncement} disabled={!announcementDraft.trim()} loading={announcementSaving} loadingText={d.publishing}>
                    {d.publishAnnouncement}
                  </Button>
                </div>
              </div>
              <div className="mt-3 max-h-[420px] space-y-3 overflow-y-auto rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface] p-3">
                {announcements.length === 0 ? (
                  <p className="p-4 text-sm text-[--color-text-muted]">{d.noAnnouncements}</p>
                ) : (
                  announcements.map((item) => (
                    <div key={item.id} className="rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface] p-4">
                      <div className="mb-2 flex items-start justify-between gap-3">
                        <p className="font-mono text-xs text-[--color-text-muted]">
                          {formatTime(item.createdAt, dict)} / {item.fromWorldChannel ? d.worldChannel : d.adminSource}
                        </p>
                        <button
                          type="button"
                          onClick={() => deleteAnnouncement(item)}
                          disabled={isBusy(`delete-announcement:${item.id}`)}
                          aria-busy={isBusy(`delete-announcement:${item.id}`) || undefined}
                          className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[--color-text-muted] hover:bg-[--color-danger-bg] hover:text-[--color-danger] disabled:opacity-50"
                          title={d.deleteAnnouncement}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <p className="whitespace-pre-wrap break-words text-sm">{item.content}</p>
                    </div>
                  ))
                )}
              </div>
            </section>
          ) : null}

          {hasPermission("manageAnnouncements") ? (
            <section>
              <div className="mb-3 flex items-center gap-2">
                <ShieldCheck size={16} />
                <h2 className="text-sm font-semibold">{d.worldBroadcasts}</h2>
              </div>
              <div className="max-h-[420px] space-y-3 overflow-y-auto rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface] p-3">
                {broadcasts.length === 0 ? (
                  <p className="p-4 text-sm text-[--color-text-muted]">{d.noBroadcasts}</p>
                ) : (
                  broadcasts.map((item) => (
                    <div key={item.id} className="rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface] p-4">
                      <div className="mb-2 flex items-start justify-between gap-3">
                        <p className="font-mono text-xs text-[--color-text-muted]">
                          {formatTime(item.createdAt, dict)} / {item.author.displayName || item.author.email}
                        </p>
                        <button
                          type="button"
                          onClick={() => deleteBroadcast(item)}
                          disabled={isBusy(`delete-broadcast:${item.id}`)}
                          aria-busy={isBusy(`delete-broadcast:${item.id}`) || undefined}
                          className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[--color-text-muted] hover:bg-[--color-danger-bg] hover:text-[--color-danger] disabled:opacity-50"
                          title={d.deleteBroadcast}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <p className="whitespace-pre-wrap break-words text-sm">{item.content}</p>
                    </div>
                  ))
                )}
              </div>
            </section>
          ) : null}

          {hasPermission("manageStickers") ? (
            <section>
              <div className="mb-3 flex items-center gap-2">
                <ImageIcon size={16} />
                <h2 className="text-sm font-semibold">{d.manageStickers}</h2>
              </div>
              <div className="rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface] p-4">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-[--radius-sm] border border-[--color-border] px-3 py-2 text-sm hover:bg-[--color-bg-hover]">
                  <Upload size={14} />
                  {stickerUploading ? dict.common.uploading : d.uploadPublicStickers}
                  <input type="file" accept="image/*" multiple className="hidden" onChange={uploadPublicStickers} disabled={stickerUploading} />
                </label>
                <div className="mt-4 grid max-h-[360px] grid-cols-4 gap-3 overflow-y-auto pr-1 sm:grid-cols-8">
                  {stickers.map((item) => (
                    <div key={item.id} className="group relative flex aspect-square items-center justify-center overflow-hidden rounded border border-[--color-border] bg-white">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={item.url} alt={item.name || item.originalName} className="max-h-full max-w-full object-contain" />
                      <button
                        type="button"
                        onClick={() => deletePublicSticker(item)}
                        disabled={isBusy(`delete-sticker:${item.id}`)}
                        aria-busy={isBusy(`delete-sticker:${item.id}`) || undefined}
                        className="absolute right-1 top-1 hidden h-8 w-8 items-center justify-center rounded-full bg-white text-[--color-danger] shadow transition hover:bg-[--color-danger-bg] disabled:opacity-50 group-hover:flex"
                        title={d.deleteSticker}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          ) : null}

          {hasPermission("manageUsers") ? (
            <section>
              <div className="mb-3 flex items-center gap-2">
                <UserCog size={16} />
                <h2 className="text-sm font-semibold">{d.userManagement}</h2>
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
                          <th className="glass-nav-bg w-[290px] border-b-2 border-[--color-border-strong] px-4 py-2.5 text-left text-xs font-medium text-[--color-text-muted]">{d.userTable.displayName}</th>
                          <th className="glass-nav-bg w-[150px] border-b-2 border-[--color-border-strong] px-4 py-2.5 text-left text-xs font-medium text-[--color-text-muted]">{d.userTable.role}</th>
                          <th className="glass-nav-bg w-[190px] border-b-2 border-[--color-border-strong] px-4 py-2.5 text-left text-xs font-medium text-[--color-text-muted]">{d.userTable.lastLogin}</th>
                          <th className="glass-nav-bg w-[150px] border-b-2 border-[--color-border-strong] px-4 py-2.5 text-left text-xs font-medium text-[--color-text-muted]">{d.userTable.deleteRule}</th>
                          {data.canManageUsers ? <th className="glass-nav-bg w-[170px] border-b-2 border-[--color-border-strong] px-4 py-2.5" /> : null}
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
                                      <SelectItem value="user">{d.role.user}</SelectItem>
                                      <SelectItem value="admin">{d.role.admin}</SelectItem>
                                    </SelectContent>
                                  </Select>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-xs">
                                    {user.role === "owner" ? <ShieldCheck size={13} /> : null}
                                    {user.role === "owner" ? d.role.owner : user.role === "admin" ? d.role.admin : d.role.user}
                                  </span>
                                )}
                              </td>
                              <td className="w-[190px] border-b border-[--color-border] bg-[--color-bg-surface] px-4 py-3 text-xs text-[--color-text-muted]">
                                {formatTime(user.lastLoginAt, dict)}
                              </td>
                              <td className="w-[150px] border-b border-[--color-border] bg-[--color-bg-surface] px-4 py-3 text-xs text-[--color-text-muted]">
                                {deleteBlockedReason ?? d.deletable}
                              </td>
                              {data.canManageUsers ? (
                                <td className="w-[170px] border-b border-[--color-border] bg-[--color-bg-surface] px-4 py-3">
                                  <div className="flex items-center justify-end gap-2">
                                    {canTransferOwner ? (
                                      <Button size="sm" variant="outline" onClick={() => transferOwner(user)} loading={isBusy(`transfer-owner:${user.id}`)} loadingText={d.transfer} className="h-8 px-2 text-xs">
                                        {d.transfer}
                                      </Button>
                                    ) : null}
                                    <button
                                      onClick={() => deleteUser(user)}
                                      disabled={Boolean(deleteBlockedReason) || isBusy(`delete-user:${user.id}`)}
                                      aria-busy={isBusy(`delete-user:${user.id}`) || undefined}
                                      className="p-1 text-[--color-text-muted] hover:text-[--color-danger] disabled:cursor-not-allowed disabled:opacity-40"
                                      title={deleteBlockedReason ?? d.deleteUser}
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                </td>
                              ) : null}
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                    {usersLoading ? <p className="p-3 text-center text-xs text-[--color-text-muted]">{d.loadingMoreUsers}</p> : null}
                  </div>
                </div>
              </div>
            </section>
          ) : null}

          {hasPermission("viewActivityLogs") ? (
            <section>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={16} />
                  <h2 className="text-sm font-semibold">{d.recentActivity}</h2>
                  <span className="text-xs text-[--color-text-muted]">
                    {d.lastRefresh}: {activitiesRefreshedAt ? formatTime(activitiesRefreshedAt, dict) : d.notRefreshedYet}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => void loadActivities(null, false)} disabled={activitiesLoading}>
                    <RotateCcw size={14} /> {activitiesLoading ? d.refreshing : d.refreshLogs}
                  </Button>
                  {hasPermission("refreshGeoLocations") ? (
                    <Button size="sm" variant="outline" onClick={refreshGeoLocations} disabled={geoRefreshing}>
                      <RotateCcw size={14} /> {geoRefreshing ? d.refreshing : d.refreshGeo}
                    </Button>
                  ) : null}
                </div>
              </div>
              <div className="overflow-hidden rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface]">
                {activities.length === 0 ? (
                  <p className="p-4 text-sm text-[--color-text-muted]">{d.noActivity}</p>
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
                            <th className="glass-nav-bg w-[160px] border-b-2 border-[--color-border-strong] px-4 py-2.5 text-left text-xs font-medium text-[--color-text-muted]">{d.activityTable.time}</th>
                            <th className="glass-nav-bg w-[170px] border-b-2 border-[--color-border-strong] px-4 py-2.5 text-left text-xs font-medium text-[--color-text-muted]">{d.activityTable.action}</th>
                            <th className="glass-nav-bg w-[300px] border-b-2 border-[--color-border-strong] px-4 py-2.5 text-left text-xs font-medium text-[--color-text-muted]">{d.activityTable.userDetail}</th>
                            <th className="glass-nav-bg w-[180px] border-b-2 border-[--color-border-strong] px-4 py-2.5 text-left text-xs font-medium text-[--color-text-muted]">{d.activityTable.ipAddress}</th>
                            <th className="glass-nav-bg w-[160px] border-b-2 border-[--color-border-strong] px-4 py-2.5 text-left text-xs font-medium text-[--color-text-muted]">{d.activityTable.geo}</th>
                            <th className="glass-nav-bg w-[140px] border-b-2 border-[--color-border-strong] px-4 py-2.5 text-left text-xs font-medium text-[--color-text-muted]">{d.activityTable.device}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {activities.map((activity) => (
                            <tr key={activity.id}>
                              <td className="w-[160px] border-b border-[--color-border] bg-[--color-bg-surface] px-4 py-3 text-xs text-[--color-text-muted]">
                                {formatTime(activity.createdAt, dict)}
                              </td>
                              <td className="w-[170px] break-words border-b border-[--color-border] bg-[--color-bg-surface] px-4 py-3 text-xs">
                                <span className={`inline-flex min-w-[72px] items-center justify-center rounded-full border px-2.5 py-1 font-mono ${activityActionClass(activity.action)}`}>
                                  {formatActivityAction(activity.action)}
                                </span>
                              </td>
                              <td className="w-[300px] break-words border-b border-[--color-border] bg-[--color-bg-surface] px-4 py-3 text-xs text-[--color-text-muted]">
                                {(activity.user?.displayName || activity.user?.email || d.system)}: {activity.detail}
                              </td>
                              <td className="w-[180px] break-all border-b border-[--color-border] bg-[--color-bg-surface] px-4 py-3 font-mono text-xs text-[--color-text-muted]">
                                {activity.ipAddress || d.unknown}
                              </td>
                              <td className="w-[160px] break-words border-b border-[--color-border] bg-[--color-bg-surface] px-4 py-3 text-xs text-[--color-text-muted]">
                                {activity.geoLocation || d.unknown}
                              </td>
                              <td className="w-[140px] break-words border-b border-[--color-border] bg-[--color-bg-surface] px-4 py-3 text-xs text-[--color-text-muted]">
                                {activity.deviceInfo || d.unknown}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {activitiesLoading ? <p className="p-3 text-center text-xs text-[--color-text-muted]">{d.loadingMoreActivity}</p> : null}
                    </div>
                  </div>
                )}
              </div>
            </section>
          ) : null}

          {hasPermission("manageUpdateLogs") ? (
            <section>
              <div className="mb-3 flex items-center gap-2">
                <GitCommitHorizontal size={16} />
                <h2 className="text-sm font-semibold">{d.changelogDisplay}</h2>
              </div>
              <div className="max-h-[520px] space-y-3 overflow-y-auto rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface] p-3">
                {data.updates.length === 0 ? (
                  <p className="p-4 text-sm text-[--color-text-muted]">{d.noUpdateRecords}</p>
                ) : (
                  data.updates.map((item) => (
                    <div key={item.hash} className={`rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface] p-4 ${item.hidden ? "opacity-55" : ""}`}>
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-mono text-xs text-[--color-text-muted]">
                            {formatTime(item.date, dict)} - {item.hash.slice(0, 12)}
                          </p>
                          <p className="mt-1 text-xs text-[--color-text-muted]">{d.originalNote}: {item.originalMessage}</p>
                        </div>
                        <span className="text-xs text-[--color-text-muted]">
                          {item.hidden ? d.status.hidden : item.useOriginal ? d.status.showingOriginalNote : d.status.showingCustomNote}
                        </span>
                      </div>
                      <textarea
                        value={updateDrafts[item.hash] ?? item.customMessage ?? item.originalMessage}
                        onChange={(event) => setUpdateDrafts((drafts) => ({ ...drafts, [item.hash]: event.target.value }))}
                        className="min-h-20 w-full rounded-[--radius-sm] border border-[--color-border-strong] bg-[--color-bg-primary] p-2 text-sm outline-none focus:border-[--color-text-primary]"
                      />
                      <div className="mt-3 flex flex-wrap justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => saveUpdateLog(item)} loading={isBusy(`update-log:${item.hash}`)} loadingText={d.saveCustomNote}>
                          <Save size={14} /> {d.saveCustomNote}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => resetUpdateLog(item)} loading={isBusy(`reset-log:${item.hash}`)} loadingText={d.restoreOriginal}>
                          <RotateCcw size={14} /> {d.restoreOriginal}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => hideUpdateLog(item)} loading={isBusy(`hide-log:${item.hash}`)} loadingText={d.hideEntry} className="text-[--color-danger]">
                          <Trash2 size={14} /> {d.hideEntry}
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          ) : null}
        </div>
      ) : null}

      <Dialog open={Boolean(selectedAdminPermission)} onOpenChange={(open) => !open && setSelectedAdminPermissionId(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{d.adminPermissions}</DialogTitle>
            <DialogDescription>
              {selectedAdminPermission
                ? `Editing permissions for ${selectedAdminPermission.displayName || selectedAdminPermission.email}.`
                : "Choose which admin capabilities should be enabled."}
            </DialogDescription>
          </DialogHeader>

          {selectedAdminPermission ? (
            <div className="grid max-h-[60vh] gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
              {ADMIN_PERMISSION_DEFS.map((permission) => (
                <label
                  key={permission.key}
                  className="flex cursor-pointer items-start gap-3 rounded-[--radius-md] border border-[--color-border] p-3 hover:bg-[--color-bg-hover]"
                >
                  <input
                    type="checkbox"
                    checked={selectedAdminPermission.permissions[permission.key]}
                    onChange={(event) => updateAdminPermission(selectedAdminPermission, permission.key, event.target.checked)}
                    className="mt-1"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-[--color-text-primary]">{permission.label}</span>
                    <span className="mt-1 block text-xs text-[--color-text-muted]">{permission.description}</span>
                  </span>
                </label>
              ))}
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedAdminPermissionId(null)}>
              {d.close}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
