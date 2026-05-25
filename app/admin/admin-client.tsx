"use client"

import { ChangeEvent, type ReactNode, UIEvent, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
  Activity,
  BarChart3,
  Bell,
  Bot,
  ClipboardList,
  Database,
  FileClock,
  GitCommitHorizontal,
  Image as ImageIcon,
  Inbox,
  KeyRound,
  LayoutDashboard,
  Megaphone,
  Palette,
  RotateCcw,
  Save,
  Settings2,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  UserCheck,
  UserCog,
  UsersRound,
} from "lucide-react"
import { toast } from "sonner"
import { AdminEmptyState, AdminInlineLink, AdminPanel, AdminShell, AdminStatCard, AdminToolbar, type AdminNavItem } from "@/components/admin/admin-shell"
import { AdminAIPanel } from "@/components/admin/admin-ai-panel"
import { AdminAIUsagePanel } from "@/components/admin/admin-ai-usage-panel"
import { AdminSqlAccessPanel } from "@/components/admin/admin-sql-access-panel"
import { AdminContentLoading } from "@/components/loading/app-loading-states"
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
  counts?: {
    totalUsers?: number
    admins?: number
    pendingRegistrations?: number
    pendingPasswordRequests?: number
  }
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

type AdminSectionKey =
  | "overview"
  | "review"
  | "users"
  | "activity"
  | "announcements"
  | "stickers"
  | "updates"
  | "ai"
  | "ai-usage"
  | "sql"
  | "permissions"

const ADMIN_SECTION_KEYS = new Set<AdminSectionKey>([
  "overview",
  "review",
  "users",
  "activity",
  "announcements",
  "stickers",
  "updates",
  "ai",
  "ai-usage",
  "sql",
  "permissions",
])

export function AdminClient() {
  const dict = getDict()
  const d = dict.admin
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

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
  }, [d.failedToLoad, refreshKey])

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
      users: data?.counts?.totalUsers ?? users.length,
      admins: data?.counts?.admins ?? users.filter((user) => user.role === "admin" || user.role === "owner").length,
      pending:
        (data?.counts?.pendingRegistrations ?? data?.requests.length ?? 0) +
        (data?.counts?.pendingPasswordRequests ?? data?.passwordRequests.length ?? 0),
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
  const requestedSection = searchParams.get("section") as AdminSectionKey | null
  const reviewCount = (data?.requests.length ?? 0) + (data?.passwordRequests.length ?? 0)

  const availableSections = useMemo(() => {
    const permissions = data?.permissions
    const sections: Array<{ key: AdminSectionKey; label: string; href: string; icon: ReactNode; badge?: string | number; description?: string }> = [
      {
        key: "overview",
        label: "概览",
        href: "/admin?section=overview",
        icon: <LayoutDashboard size={17} />,
        description: "关键指标与快捷入口",
      },
    ]

    if (permissions?.approveRegistrations || permissions?.approvePasswordChanges) {
      sections.push({
        key: "review",
        label: "待审核",
        href: "/admin?section=review",
        icon: <Inbox size={17} />,
        badge: reviewCount || undefined,
        description: "注册与密码申请",
      })
    }
    if (permissions?.manageUsers) {
      sections.push({
        key: "users",
        label: "成员管理",
        href: "/admin?section=users",
        icon: <UsersRound size={17} />,
        description: "角色、删除与登录状态",
      })
    }
    if (permissions?.viewActivityLogs) {
      sections.push({
        key: "activity",
        label: "活动日志",
        href: "/admin?section=activity",
        icon: <Activity size={17} />,
        description: "登录、设备与安全轨迹",
      })
    }
    if (permissions?.manageAnnouncements) {
      sections.push({
        key: "announcements",
        label: "公告广播",
        href: "/admin?section=announcements",
        icon: <Megaphone size={17} />,
        description: "站内公告与世界广播",
      })
    }
    if (permissions?.manageStickers) {
      sections.push({
        key: "stickers",
        label: "公共表情",
        href: "/admin?section=stickers",
        icon: <ImageIcon size={17} />,
        badge: stickers.length || undefined,
        description: "公共表情库维护",
      })
    }
    if (permissions?.manageUpdateLogs) {
      sections.push({
        key: "updates",
        label: "更新日志",
        href: "/admin?section=updates",
        icon: <GitCommitHorizontal size={17} />,
        description: "版本记录展示控制",
      })
    }
    if (permissions?.manageAI) {
      sections.push(
        {
          key: "ai",
          label: "AI 授权",
          href: "/admin?section=ai",
          icon: <Bot size={17} />,
          description: "访问申请与模型授权",
        },
        {
          key: "ai-usage",
          label: "AI 用量",
          href: "/admin?section=ai-usage",
          icon: <BarChart3 size={17} />,
          description: "Token 与调用统计",
        }
      )
    }
    if (permissions?.manageSqlLab) {
      sections.push({
        key: "sql",
        label: "SQL 授权",
        href: "/admin?section=sql",
        icon: <Database size={17} />,
        description: "实验室数据表权限",
      })
    }
    if (data?.currentAdmin.role === "owner") {
      sections.push({
        key: "permissions",
        label: "管理员权限",
        href: "/admin?section=permissions",
        icon: <ShieldCheck size={17} />,
        description: "权限矩阵与所有权",
      })
    }

    return sections
  }, [data, reviewCount, stickers.length])

  const firstSection = availableSections[0]?.key ?? "overview"
  const activeSection =
    requestedSection && ADMIN_SECTION_KEYS.has(requestedSection) && availableSections.some((item) => item.key === requestedSection)
      ? requestedSection
      : firstSection
  const shellNavItems: AdminNavItem[] = [
    ...availableSections,
    ...(data?.currentAdmin.role === "owner"
      ? [
          {
            key: "resume-themes",
            label: "简历主题",
            href: "/admin/resume-themes",
            icon: <Palette size={17} />,
            description: "主题验证与配置",
          },
          {
            key: "roundtable",
            label: "圆桌管理",
            href: "/channels/soulwing-roundtable",
            icon: <Sparkles size={17} />,
            description: "蝶灵圆桌控制台",
          },
        ]
      : []),
  ]

  useEffect(() => {
    if (!data) return
    if (requestedSection === activeSection) return
    router.replace(`${pathname}?section=${activeSection}`)
  }, [activeSection, data, pathname, requestedSection, router])

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
    <AdminShell
      title="管理后台"
      description="集中处理审核、成员、公告、AI、SQL 与系统维护。每次只打开一个工作区，减少后台操作时的上下滚动。"
      eyebrow={data?.currentAdmin.role === "owner" ? "Owner Console" : "Admin Console"}
      navItems={shellNavItems}
      activeKey={activeSection}
      actions={
        <Button variant="outline" onClick={() => setRefreshKey((key) => key + 1)} disabled={loading}>
          <RotateCcw size={15} />
          {loading ? d.refreshing : "刷新数据"}
        </Button>
      }
    >
      {loading ? (
        <AdminContentLoading />
      ) : data ? (
        <>
          {activeSection === "overview" ? (
            <div className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <AdminStatCard label={d.pendingApprovals} value={stats.pending} hint="注册与密码修改待处理" icon={<Inbox size={18} />} tone={stats.pending > 0 ? "orange" : "blue"} />
                <AdminStatCard label={d.loadedUsers} value={`${stats.users}${usersHasMore ? "+" : ""}`} hint="当前后台可见成员规模" icon={<UsersRound size={18} />} />
                <AdminStatCard label={d.admins} value={stats.admins} hint="Owner 与管理员总数" icon={<ShieldCheck size={18} />} tone="green" />
                <AdminStatCard label="可用模块" value={availableSections.length} hint="按当前权限动态展示" icon={<LayoutDashboard size={18} />} tone="slate" />
              </div>

              <div className="grid gap-5 2xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
                <AdminPanel title="待处理队列" description="需要管理员介入的事项会集中在这里。" icon={<Inbox size={18} />}>
                  <div className="grid gap-3 lg:grid-cols-2">
                    <div className="rounded-[18px] border border-slate-200 bg-slate-50/70 p-4">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-slate-800">{d.registrationApprovals}</p>
                        <span className="rounded-full bg-white px-2.5 py-1 text-xs text-slate-500 ring-1 ring-slate-200">{data.requests.length}</span>
                      </div>
                      {data.requests.length === 0 ? (
                        <AdminEmptyState title={d.noRegistrationRequests} icon={<UserCheck size={18} />} />
                      ) : (
                        <div className="space-y-2">
                          {data.requests.slice(0, 4).map((request) => (
                            <div key={request.id} className="rounded-[14px] bg-white p-3 ring-1 ring-slate-200">
                              <p className="truncate text-sm font-medium text-slate-900">{request.displayName}</p>
                              <p className="truncate font-mono text-xs text-slate-500">{request.email}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="rounded-[18px] border border-slate-200 bg-slate-50/70 p-4">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-slate-800">{d.passwordApprovals}</p>
                        <span className="rounded-full bg-white px-2.5 py-1 text-xs text-slate-500 ring-1 ring-slate-200">{data.passwordRequests.length}</span>
                      </div>
                      {data.passwordRequests.length === 0 ? (
                        <AdminEmptyState title={d.noPasswordRequests} icon={<KeyRound size={18} />} />
                      ) : (
                        <div className="space-y-2">
                          {data.passwordRequests.slice(0, 4).map((request) => (
                            <div key={request.id} className="rounded-[14px] bg-white p-3 ring-1 ring-slate-200">
                              <p className="truncate text-sm font-medium text-slate-900">{request.user.displayName || request.user.email}</p>
                              <p className="truncate font-mono text-xs text-slate-500">{request.user.email}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  {availableSections.some((item) => item.key === "review") ? (
                    <div className="mt-4">
                      <AdminInlineLink href="/admin?section=review">处理审核</AdminInlineLink>
                    </div>
                  ) : null}
                </AdminPanel>

                <AdminPanel title={d.recentActivity} description={activitiesRefreshedAt ? `${d.lastRefresh}: ${formatTime(activitiesRefreshedAt, dict)}` : d.notRefreshedYet} icon={<Activity size={18} />}>
                  {activities.length === 0 ? (
                    <AdminEmptyState title={d.noActivity} icon={<FileClock size={18} />} />
                  ) : (
                    <div className="space-y-2">
                      {activities.slice(0, 6).map((activity) => (
                        <div key={activity.id} className="rounded-[14px] border border-slate-200 bg-slate-50/70 px-3 py-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`inline-flex min-w-[72px] items-center justify-center rounded-full border px-2.5 py-1 font-mono text-xs ${activityActionClass(activity.action)}`}>
                              {formatActivityAction(activity.action)}
                            </span>
                            <span className="text-xs text-slate-500">{formatTime(activity.createdAt, dict)}</span>
                          </div>
                          <p className="mt-1 line-clamp-2 text-sm text-slate-600">
                            {(activity.user?.displayName || activity.user?.email || d.system)}: {activity.detail}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                  {availableSections.some((item) => item.key === "activity") ? (
                    <div className="mt-4">
                      <AdminInlineLink href="/admin?section=activity">查看活动日志</AdminInlineLink>
                    </div>
                  ) : null}
                </AdminPanel>
              </div>

              <AdminPanel title="管理入口" description="按权限显示当前可操作的后台模块。" icon={<LayoutDashboard size={18} />}>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {shellNavItems.filter((item) => item.key !== "overview").map((item) => (
                    <Link
                      key={item.key}
                      href={item.href}
                      className="group rounded-[18px] border border-slate-200 bg-slate-50/70 p-4 transition hover:border-blue-200 hover:bg-blue-50 hover:no-underline"
                    >
                      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-[14px] bg-white text-blue-600 shadow-sm ring-1 ring-slate-200 group-hover:ring-blue-200">
                        {item.icon}
                      </div>
                      <p className="font-semibold text-slate-900">{item.label}</p>
                      {item.description ? <p className="mt-1 text-sm leading-5 text-slate-500">{item.description}</p> : null}
                    </Link>
                  ))}
                </div>
              </AdminPanel>
            </div>
          ) : null}

          {activeSection === "review" ? (
            <div className="grid gap-5 xl:grid-cols-2">
              {hasPermission("approveRegistrations") ? (
                <AdminPanel title={d.registrationApprovals} description="审核新成员注册请求。" icon={<UserCheck size={18} />}>
                  <div className="max-h-[620px] overflow-y-auto pr-1">
                    {data.requests.length === 0 ? (
                      <AdminEmptyState title={d.noRegistrationRequests} icon={<UserCheck size={18} />} />
                    ) : (
                      <div className="space-y-3">
                        {data.requests.map((request) => (
                          <div key={request.id} className="flex flex-col gap-3 rounded-[18px] border border-slate-200 bg-slate-50/70 p-4 sm:flex-row sm:items-center">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-slate-900">{request.displayName}</p>
                              <p className="break-all font-mono text-xs text-slate-500">{request.email}</p>
                              <p className="mt-1 text-xs text-slate-400">{formatTime(request.createdAt, dict)}</p>
                            </div>
                            <Button onClick={() => approve(request.id)} loading={isBusy(`approve:${request.id}`)} loadingText={d.approve}>
                              {d.approve}
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </AdminPanel>
              ) : null}

              {hasPermission("approvePasswordChanges") ? (
                <AdminPanel title={d.passwordApprovals} description="处理成员密码修改请求。" icon={<KeyRound size={18} />}>
                  <div className="max-h-[620px] overflow-y-auto pr-1">
                    {data.passwordRequests.length === 0 ? (
                      <AdminEmptyState title={d.noPasswordRequests} icon={<KeyRound size={18} />} />
                    ) : (
                      <div className="space-y-3">
                        {data.passwordRequests.map((request) => (
                          <div key={request.id} className="flex flex-col gap-3 rounded-[18px] border border-slate-200 bg-slate-50/70 p-4 sm:flex-row sm:items-center">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-slate-900">{request.user.displayName || request.user.email}</p>
                              <p className="break-all font-mono text-xs text-slate-500">{request.user.email}</p>
                              <p className="mt-1 text-xs text-slate-400">{formatTime(request.requestedAt, dict)}</p>
                            </div>
                            <Button onClick={() => approvePassword(request.id)} loading={isBusy(`approve-password:${request.id}`)} loadingText={d.approve}>
                              {d.approve}
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </AdminPanel>
              ) : null}
            </div>
          ) : null}

          {activeSection === "ai" ? <AdminAIPanel enabled={hasPermission("manageAI")} /> : null}
          {activeSection === "ai-usage" ? <AdminAIUsagePanel enabled={hasPermission("manageAI")} /> : null}
          {activeSection === "sql" && hasPermission("manageSqlLab") ? <AdminSqlAccessPanel /> : null}

          {activeSection === "permissions" && data.currentAdmin.role === "owner" ? (
            <div className="space-y-5">
              <AdminPanel title={d.transferOwnership} description={d.transferOwnerDesc} icon={<ShieldCheck size={18} />}>
                <AdminToolbar>
                  <Select
                    value={effectiveOwnerTransferTargetId}
                    onValueChange={setOwnerTransferTargetId}
                    disabled={ownerTransferCandidates.length === 0}
                  >
                    <SelectTrigger className="h-11 w-full bg-white text-sm sm:w-[320px]">
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
                    variant="outline"
                    onClick={() => selectedOwnerTransferUser && transferOwner(selectedOwnerTransferUser)}
                    disabled={!selectedOwnerTransferUser}
                    loading={selectedOwnerTransferUser ? isBusy(`transfer-owner:${selectedOwnerTransferUser.id}`) : false}
                    loadingText="Transferring..."
                  >
                    {d.transferOwner}
                  </Button>
                </AdminToolbar>
              </AdminPanel>

              <AdminPanel title={d.adminPermissions} description={d.chooseAdminEdit} icon={<Settings2 size={18} />}>
                {adminPermissions.length === 0 ? (
                  <AdminEmptyState title={d.noExtraAdmins} icon={<ShieldCheck size={18} />} />
                ) : (
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {adminPermissions.map((admin) => (
                      <button
                        key={admin.id}
                        type="button"
                        onClick={() => setSelectedAdminPermissionId(admin.id)}
                        className="rounded-[18px] border border-slate-200 bg-slate-50/70 p-4 text-left transition hover:border-blue-200 hover:bg-blue-50"
                      >
                        <p className="truncate text-sm font-semibold text-slate-900">{admin.displayName || admin.email}</p>
                        <p className="mt-1 truncate font-mono text-xs text-slate-500">{admin.email}</p>
                        <p className="mt-3 text-xs text-slate-500">
                          {d.permissionsEnabled(ADMIN_PERMISSION_DEFS.filter((permission) => admin.permissions[permission.key]).length)}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </AdminPanel>
            </div>
          ) : null}

          {activeSection === "announcements" && hasPermission("manageAnnouncements") ? (
            <div className="grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
              <AdminPanel title={d.announcements} description="发布导航公告并查看历史记录。" icon={<Bell size={18} />}>
                <textarea
                  value={announcementDraft}
                  onChange={(event) => setAnnouncementDraft(event.target.value)}
                  maxLength={500}
                  placeholder={d.announcementPlaceholder}
                  className="min-h-32 w-full rounded-[18px] border border-slate-200 bg-slate-50/70 p-3 text-sm outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100"
                />
                <div className="mt-3 flex items-center justify-between">
                  <span className="font-mono text-xs text-slate-400">{announcementDraft.length}/500</span>
                  <Button onClick={publishAnnouncement} disabled={!announcementDraft.trim()} loading={announcementSaving} loadingText={d.publishing}>
                    {d.publishAnnouncement}
                  </Button>
                </div>
                <div className="mt-4 max-h-[520px] space-y-3 overflow-y-auto pr-1">
                  {announcements.length === 0 ? (
                    <AdminEmptyState title={d.noAnnouncements} icon={<Bell size={18} />} />
                  ) : (
                    announcements.map((item) => (
                      <div key={item.id} className="rounded-[18px] border border-slate-200 bg-slate-50/70 p-4">
                        <div className="mb-2 flex items-start justify-between gap-3">
                          <p className="font-mono text-xs text-slate-500">
                            {formatTime(item.createdAt, dict)} / {item.fromWorldChannel ? d.worldChannel : d.adminSource}
                          </p>
                          <button
                            type="button"
                            onClick={() => deleteAnnouncement(item)}
                            disabled={isBusy(`delete-announcement:${item.id}`)}
                            aria-busy={isBusy(`delete-announcement:${item.id}`) || undefined}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                            title={d.deleteAnnouncement}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                        <p className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">{item.content}</p>
                      </div>
                    ))
                  )}
                </div>
              </AdminPanel>

              <AdminPanel title={d.worldBroadcasts} description="世界频道广播记录与清理。" icon={<Megaphone size={18} />}>
                <div className="max-h-[620px] space-y-3 overflow-y-auto pr-1">
                  {broadcasts.length === 0 ? (
                    <AdminEmptyState title={d.noBroadcasts} icon={<Megaphone size={18} />} />
                  ) : (
                    broadcasts.map((item) => (
                      <div key={item.id} className="rounded-[18px] border border-slate-200 bg-slate-50/70 p-4">
                        <div className="mb-2 flex items-start justify-between gap-3">
                          <p className="font-mono text-xs text-slate-500">
                            {formatTime(item.createdAt, dict)} / {item.author.displayName || item.author.email}
                          </p>
                          <button
                            type="button"
                            onClick={() => deleteBroadcast(item)}
                            disabled={isBusy(`delete-broadcast:${item.id}`)}
                            aria-busy={isBusy(`delete-broadcast:${item.id}`) || undefined}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                            title={d.deleteBroadcast}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                        <p className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">{item.content}</p>
                      </div>
                    ))
                  )}
                </div>
              </AdminPanel>
            </div>
          ) : null}

          {activeSection === "stickers" && hasPermission("manageStickers") ? (
            <AdminPanel
              title={d.manageStickers}
              description="维护公共表情库，上传后会出现在聊天表情入口。"
              icon={<ImageIcon size={18} />}
              action={
                <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 text-sm font-medium text-blue-700 transition hover:bg-blue-100">
                  <Upload size={14} />
                  {stickerUploading ? dict.common.uploading : d.uploadPublicStickers}
                  <input type="file" accept="image/*" multiple className="hidden" onChange={uploadPublicStickers} disabled={stickerUploading} />
                </label>
              }
            >
              {stickers.length === 0 ? (
                <AdminEmptyState title="还没有公共表情" description="上传常用表情后，成员可以在聊天中直接使用。" icon={<ImageIcon size={18} />} />
              ) : (
                <div className="grid max-h-[680px] grid-cols-3 gap-3 overflow-y-auto pr-1 sm:grid-cols-5 lg:grid-cols-8 2xl:grid-cols-10">
                  {stickers.map((item) => (
                    <div key={item.id} className="group relative flex aspect-square items-center justify-center overflow-hidden rounded-[18px] border border-slate-200 bg-slate-50/70 p-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={item.url} alt={item.name || item.originalName} className="max-h-full max-w-full object-contain" />
                      <button
                        type="button"
                        onClick={() => deletePublicSticker(item)}
                        disabled={isBusy(`delete-sticker:${item.id}`)}
                        aria-busy={isBusy(`delete-sticker:${item.id}`) || undefined}
                        className="absolute right-2 top-2 hidden h-8 w-8 items-center justify-center rounded-full bg-white text-rose-600 shadow transition hover:bg-rose-50 disabled:opacity-50 group-hover:flex"
                        title={d.deleteSticker}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </AdminPanel>
          ) : null}

          {activeSection === "users" && hasPermission("manageUsers") ? (
            <AdminPanel title={d.userManagement} description="成员角色、所有权转让与删除规则集中在这里。" icon={<UserCog size={18} />}>
              <div className="overflow-hidden rounded-[18px] border border-slate-200 bg-white">
                <div
                  className="max-h-[680px] overflow-auto"
                  onScroll={(event) => {
                    if (isNearBottom(event) && usersHasMore && !usersLoading) void loadUsers(usersCursor, true)
                  }}
                >
                  <div className="min-w-[950px]">
                    <table className="w-full table-fixed border-separate border-spacing-0 text-sm">
                      <thead className="sticky top-0 z-10">
                        <tr>
                          <th className="w-[290px] border-b border-slate-200 bg-slate-50 px-4 py-3 text-left text-xs font-semibold text-slate-500">{d.userTable.displayName}</th>
                          <th className="w-[150px] border-b border-slate-200 bg-slate-50 px-4 py-3 text-left text-xs font-semibold text-slate-500">{d.userTable.role}</th>
                          <th className="w-[190px] border-b border-slate-200 bg-slate-50 px-4 py-3 text-left text-xs font-semibold text-slate-500">{d.userTable.lastLogin}</th>
                          <th className="w-[150px] border-b border-slate-200 bg-slate-50 px-4 py-3 text-left text-xs font-semibold text-slate-500">{d.userTable.deleteRule}</th>
                          {data.canManageUsers ? <th className="w-[170px] border-b border-slate-200 bg-slate-50 px-4 py-3" /> : null}
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
                            <tr key={user.id} className="hover:bg-blue-50/40">
                              <td className="w-[290px] border-b border-slate-100 bg-white px-4 py-3">
                                <p className="truncate font-medium text-slate-900">{user.displayName || user.email}</p>
                                <p className="truncate font-mono text-xs text-slate-500">{user.email}</p>
                              </td>
                              <td className="w-[150px] border-b border-slate-100 bg-white px-4 py-3">
                                {canEditRole ? (
                                  <Select value={user.role === "admin" ? "admin" : "user"} onValueChange={(role) => updateRole(user.id, role)}>
                                    <SelectTrigger className="h-9 bg-slate-50 text-xs">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="user">{d.role.user}</SelectItem>
                                      <SelectItem value="admin">{d.role.admin}</SelectItem>
                                    </SelectContent>
                                  </Select>
                                ) : (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2.5 py-1 text-xs text-slate-600 ring-1 ring-slate-200">
                                    {user.role === "owner" ? <ShieldCheck size={13} /> : null}
                                    {user.role === "owner" ? d.role.owner : user.role === "admin" ? d.role.admin : d.role.user}
                                  </span>
                                )}
                              </td>
                              <td className="w-[190px] border-b border-slate-100 bg-white px-4 py-3 text-xs text-slate-500">
                                {formatTime(user.lastLoginAt, dict)}
                              </td>
                              <td className="w-[150px] border-b border-slate-100 bg-white px-4 py-3 text-xs text-slate-500">
                                {deleteBlockedReason ?? d.deletable}
                              </td>
                              {data.canManageUsers ? (
                                <td className="w-[170px] border-b border-slate-100 bg-white px-4 py-3">
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
                                      className="rounded-full p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-40"
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
                    {usersLoading ? <p className="p-3 text-center text-xs text-slate-500">{d.loadingMoreUsers}</p> : null}
                  </div>
                </div>
              </div>
            </AdminPanel>
          ) : null}

          {activeSection === "activity" && hasPermission("viewActivityLogs") ? (
            <AdminPanel
              title={d.recentActivity}
              description={`${d.lastRefresh}: ${activitiesRefreshedAt ? formatTime(activitiesRefreshedAt, dict) : d.notRefreshedYet}`}
              icon={<Activity size={18} />}
              action={
                <>
                  <Button variant="outline" onClick={() => void loadActivities(null, false)} disabled={activitiesLoading}>
                    <RotateCcw size={14} /> {activitiesLoading ? d.refreshing : d.refreshLogs}
                  </Button>
                  {hasPermission("refreshGeoLocations") ? (
                    <Button variant="outline" onClick={refreshGeoLocations} disabled={geoRefreshing}>
                      <RotateCcw size={14} /> {geoRefreshing ? d.refreshing : d.refreshGeo}
                    </Button>
                  ) : null}
                </>
              }
            >
              {activities.length === 0 ? (
                <AdminEmptyState title={d.noActivity} icon={<Activity size={18} />} />
              ) : (
                <div
                  className="max-h-[680px] overflow-auto rounded-[18px] border border-slate-200"
                  onScroll={(event) => {
                    if (isNearBottom(event) && activitiesHasMore && !activitiesLoading) void loadActivities(activitiesCursor, true)
                  }}
                >
                  <div className="min-w-[1080px]">
                    <table className="w-full table-fixed border-separate border-spacing-0 bg-white text-sm">
                      <thead className="sticky top-0 z-10">
                        <tr>
                          <th className="w-[160px] border-b border-slate-200 bg-slate-50 px-4 py-3 text-left text-xs font-semibold text-slate-500">{d.activityTable.time}</th>
                          <th className="w-[170px] border-b border-slate-200 bg-slate-50 px-4 py-3 text-left text-xs font-semibold text-slate-500">{d.activityTable.action}</th>
                          <th className="w-[300px] border-b border-slate-200 bg-slate-50 px-4 py-3 text-left text-xs font-semibold text-slate-500">{d.activityTable.userDetail}</th>
                          <th className="w-[180px] border-b border-slate-200 bg-slate-50 px-4 py-3 text-left text-xs font-semibold text-slate-500">{d.activityTable.ipAddress}</th>
                          <th className="w-[160px] border-b border-slate-200 bg-slate-50 px-4 py-3 text-left text-xs font-semibold text-slate-500">{d.activityTable.geo}</th>
                          <th className="w-[140px] border-b border-slate-200 bg-slate-50 px-4 py-3 text-left text-xs font-semibold text-slate-500">{d.activityTable.device}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activities.map((activity) => (
                          <tr key={activity.id} className="hover:bg-blue-50/40">
                            <td className="w-[160px] border-b border-slate-100 bg-white px-4 py-3 text-xs text-slate-500">
                              {formatTime(activity.createdAt, dict)}
                            </td>
                            <td className="w-[170px] break-words border-b border-slate-100 bg-white px-4 py-3 text-xs">
                              <span className={`inline-flex min-w-[72px] items-center justify-center rounded-full border px-2.5 py-1 font-mono ${activityActionClass(activity.action)}`}>
                                {formatActivityAction(activity.action)}
                              </span>
                            </td>
                            <td className="w-[300px] break-words border-b border-slate-100 bg-white px-4 py-3 text-xs text-slate-500">
                              {(activity.user?.displayName || activity.user?.email || d.system)}: {activity.detail}
                            </td>
                            <td className="w-[180px] break-all border-b border-slate-100 bg-white px-4 py-3 font-mono text-xs text-slate-500">
                              {activity.ipAddress || d.unknown}
                            </td>
                            <td className="w-[160px] break-words border-b border-slate-100 bg-white px-4 py-3 text-xs text-slate-500">
                              {activity.geoLocation || d.unknown}
                            </td>
                            <td className="w-[140px] break-words border-b border-slate-100 bg-white px-4 py-3 text-xs text-slate-500">
                              {activity.deviceInfo || d.unknown}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {activitiesLoading ? <p className="p-3 text-center text-xs text-slate-500">{d.loadingMoreActivity}</p> : null}
                  </div>
                </div>
              )}
            </AdminPanel>
          ) : null}

          {activeSection === "updates" && hasPermission("manageUpdateLogs") ? (
            <AdminPanel title={d.changelogDisplay} description="编辑对外展示的更新记录，或隐藏不适合展示的提交。" icon={<GitCommitHorizontal size={18} />}>
              <div className="max-h-[720px] space-y-3 overflow-y-auto pr-1">
                {data.updates.length === 0 ? (
                  <AdminEmptyState title={d.noUpdateRecords} icon={<ClipboardList size={18} />} />
                ) : (
                  data.updates.map((item) => (
                    <div key={item.hash} className={`rounded-[18px] border border-slate-200 bg-slate-50/70 p-4 ${item.hidden ? "opacity-55" : ""}`}>
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-mono text-xs text-slate-500">
                            {formatTime(item.date, dict)} - {item.hash.slice(0, 12)}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">{d.originalNote}: {item.originalMessage}</p>
                        </div>
                        <span className="rounded-full bg-white px-2.5 py-1 text-xs text-slate-500 ring-1 ring-slate-200">
                          {item.hidden ? d.status.hidden : item.useOriginal ? d.status.showingOriginalNote : d.status.showingCustomNote}
                        </span>
                      </div>
                      <textarea
                        value={updateDrafts[item.hash] ?? item.customMessage ?? item.originalMessage}
                        onChange={(event) => setUpdateDrafts((drafts) => ({ ...drafts, [item.hash]: event.target.value }))}
                        className="min-h-24 w-full rounded-[16px] border border-slate-200 bg-white p-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                      />
                      <div className="mt-3 flex flex-wrap justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => saveUpdateLog(item)} loading={isBusy(`update-log:${item.hash}`)} loadingText={d.saveCustomNote}>
                          <Save size={14} /> {d.saveCustomNote}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => resetUpdateLog(item)} loading={isBusy(`reset-log:${item.hash}`)} loadingText={d.restoreOriginal}>
                          <RotateCcw size={14} /> {d.restoreOriginal}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => hideUpdateLog(item)} loading={isBusy(`hide-log:${item.hash}`)} loadingText={d.hideEntry} className="text-rose-600">
                          <Trash2 size={14} /> {d.hideEntry}
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </AdminPanel>
          ) : null}
        </>
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
    </AdminShell>
  )
}
