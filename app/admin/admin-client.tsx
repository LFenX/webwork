"use client"

import { UIEvent, useEffect, useMemo, useState } from "react"
import { GitCommitHorizontal, KeyRound, RotateCcw, Save, ShieldCheck, Trash2, UserCheck, UserCog } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { apiDelete, apiFetch, apiPatch, apiPost } from "@/lib/api-client"
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

type Overview = {
  currentAdmin: UserItem
  canManageUsers: boolean
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

function isNearBottom(event: UIEvent<HTMLDivElement>) {
  const target = event.currentTarget
  return target.scrollTop + target.clientHeight >= target.scrollHeight - 120
}

export function AdminClient() {
  const [data, setData] = useState<Overview | null>(null)
  const [users, setUsers] = useState<UserItem[]>([])
  const [activities, setActivities] = useState<Activity[]>([])
  const [usersCursor, setUsersCursor] = useState<string | null>(null)
  const [activitiesCursor, setActivitiesCursor] = useState<string | null>(null)
  const [usersHasMore, setUsersHasMore] = useState(false)
  const [activitiesHasMore, setActivitiesHasMore] = useState(false)
  const [usersLoading, setUsersLoading] = useState(false)
  const [activitiesLoading, setActivitiesLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  const [updateDrafts, setUpdateDrafts] = useState<Record<string, string>>({})
  const [geoRefreshing, setGeoRefreshing] = useState(false)

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

  async function loadActivities(cursor: string | null, append: boolean) {
    setActivitiesLoading(true)
    try {
      const params = new URLSearchParams({ limit: "50" })
      if (cursor) params.set("cursor", cursor)
      const page = await apiFetch<PageResult<Activity>>(`/api/admin/activities?${params.toString()}`)
      setActivities((current) => append ? [...current, ...page.items] : page.items)
      setActivitiesCursor(page.nextCursor)
      setActivitiesHasMore(page.hasMore)
    } finally {
      setActivitiesLoading(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const overview = await apiFetch<Overview>("/api/admin/overview")
        if (cancelled) return
        setData(overview)
        await Promise.all([loadUsers(null, false), loadActivities(null, false)])
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

  const stats = useMemo(() => ({
    users: users.length,
    admins: users.filter((user) => user.role === "admin" || user.role === "owner").length,
    pending: (data?.requests.length ?? 0) + (data?.passwordRequests.length ?? 0),
  }), [data, users])

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
          <section>
            <div className="mb-3 flex items-center gap-2">
              <UserCheck size={16} />
              <h2 className="text-sm font-semibold">注册审核</h2>
            </div>
            <div className="overflow-hidden rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface]">
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

          <section>
            <div className="mb-3 flex items-center gap-2">
              <KeyRound size={16} />
              <h2 className="text-sm font-semibold">密码修改审核</h2>
            </div>
            <div className="overflow-hidden rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface]">
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

          <section>
            <div className="mb-3 flex items-center gap-2">
              <UserCog size={16} />
              <h2 className="text-sm font-semibold">用户管理</h2>
            </div>
            <div
              className="max-h-[520px] overflow-auto rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface]"
              onScroll={(event) => {
                if (isNearBottom(event) && usersHasMore && !usersLoading) void loadUsers(usersCursor, true)
              }}
            >
              <table className="w-full min-w-[860px] table-fixed text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="border-b-2 border-[--color-border-strong] bg-[--color-bg-hover]">
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-[--color-text-muted]">用户</th>
                    <th className="w-[150px] px-4 py-2.5 text-left text-xs font-medium text-[--color-text-muted]">权限</th>
                    <th className="w-[190px] px-4 py-2.5 text-left text-xs font-medium text-[--color-text-muted]">最近登录</th>
                    <th className="w-[150px] px-4 py-2.5 text-left text-xs font-medium text-[--color-text-muted]">删除条件</th>
                    {data.canManageUsers && <th className="w-[80px] px-4 py-2.5" />}
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => {
                    const inactiveDays = daysSince(user.lastLoginAt)
                    const deletable = inactiveDays !== null && inactiveDays >= 30
                    return (
                      <tr key={user.id} className="border-b border-[--color-border] last:border-b-0">
                        <td className="px-4 py-3">
                          <p className="truncate font-medium">{user.displayName || user.email}</p>
                          <p className="truncate font-mono text-xs text-[--color-text-muted]">{user.email}</p>
                        </td>
                        <td className="px-4 py-3">
                          {data.canManageUsers && user.role !== "owner" ? (
                            <Select value={user.role === "admin" ? "admin" : "user"} onValueChange={(role) => updateRole(user.id, role)}>
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="user">成员</SelectItem>
                                <SelectItem value="admin">普通管理员</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs">
                              {user.role === "owner" && <ShieldCheck size={13} />}
                              {user.role === "owner" ? "终极管理员" : user.role === "admin" ? "普通管理员" : "成员"}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-[--color-text-muted]">{formatTime(user.lastLoginAt)}</td>
                        <td className="px-4 py-3 text-xs text-[--color-text-muted]">
                          {deletable ? "可删除" : inactiveDays === null ? "从未登录，不可删" : `还需 ${30 - inactiveDays} 天`}
                        </td>
                        {data.canManageUsers && (
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => deleteUser(user)}
                              className="p-1 text-[--color-text-muted] hover:text-[--color-danger]"
                              title="删除用户"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {usersLoading && <p className="p-3 text-center text-xs text-[--color-text-muted]">加载更多成员...</p>}
            </div>
          </section>

          <section>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <ShieldCheck size={16} />
                <h2 className="text-sm font-semibold">最近登录和操作行为</h2>
              </div>
              {data.canManageUsers && (
                <Button size="sm" variant="outline" onClick={refreshGeoLocations} disabled={geoRefreshing}>
                  <RotateCcw size={14} /> {geoRefreshing ? "更新中..." : "更新 IP 地理位置"}
                </Button>
              )}
            </div>
            <div
              className="max-h-[560px] overflow-auto rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface]"
              onScroll={(event) => {
                if (isNearBottom(event) && activitiesHasMore && !activitiesLoading) void loadActivities(activitiesCursor, true)
              }}
            >
              {activities.length === 0 ? (
                <p className="p-4 text-sm text-[--color-text-muted]">暂无行为记录</p>
              ) : (
                <table className="w-full min-w-[1080px] table-fixed text-sm">
                  <thead className="sticky top-0 z-10">
                    <tr className="border-b-2 border-[--color-border-strong] bg-[--color-bg-hover]">
                      <th className="w-[160px] px-4 py-2.5 text-left text-xs font-medium text-[--color-text-muted]">时间</th>
                      <th className="w-[170px] px-4 py-2.5 text-left text-xs font-medium text-[--color-text-muted]">行为</th>
                      <th className="w-[300px] px-4 py-2.5 text-left text-xs font-medium text-[--color-text-muted]">用户与详情</th>
                      <th className="w-[180px] px-4 py-2.5 text-left text-xs font-medium text-[--color-text-muted]">IP 地址</th>
                      <th className="w-[160px] px-4 py-2.5 text-left text-xs font-medium text-[--color-text-muted]">地理位置</th>
                      <th className="w-[140px] px-4 py-2.5 text-left text-xs font-medium text-[--color-text-muted]">设备信息</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activities.map((activity) => (
                      <tr key={activity.id} className="border-b border-[--color-border] last:border-b-0">
                        <td className="px-4 py-3 text-xs text-[--color-text-muted]">{formatTime(activity.createdAt)}</td>
                        <td className="break-words px-4 py-3 font-mono text-xs text-[--color-text-secondary]">{activity.action}</td>
                        <td className="break-words px-4 py-3 text-xs text-[--color-text-muted]">
                          {(activity.user?.displayName || activity.user?.email || "系统")}：{activity.detail}
                        </td>
                        <td className="break-all px-4 py-3 font-mono text-xs text-[--color-text-muted]">{activity.ipAddress || "未知"}</td>
                        <td className="break-words px-4 py-3 text-xs text-[--color-text-muted]">{activity.geoLocation || "未知"}</td>
                        <td className="break-words px-4 py-3 text-xs text-[--color-text-muted]">{activity.deviceInfo || "未知"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {activitiesLoading && <p className="p-3 text-center text-xs text-[--color-text-muted]">加载更多日志...</p>}
            </div>
          </section>

          {data.canManageUsers && (
            <section>
              <div className="mb-3 flex items-center gap-2">
                <GitCommitHorizontal size={16} />
                <h2 className="text-sm font-semibold">更新日志展示管理</h2>
              </div>
              <div className="space-y-3">
                {data.updates.length === 0 ? (
                  <p className="rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface] p-4 text-sm text-[--color-text-muted]">暂无 Git 更新记录</p>
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
