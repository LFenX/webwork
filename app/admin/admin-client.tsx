"use client"

import { useEffect, useMemo, useState } from "react"
import { KeyRound, ShieldCheck, Trash2, UserCog, UserCheck } from "lucide-react"
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
  createdAt: string
  user: { email: string; displayName: string } | null
}

type Overview = {
  currentAdmin: UserItem
  canManageUsers: boolean
  requests: RegistrationRequest[]
  passwordRequests: PasswordChangeRequest[]
  users: UserItem[]
  activities: Activity[]
}

function formatTime(value: string | null) {
  if (!value) return "从未登录"
  return formatChinaDateTime(value)
}

function daysSince(value: string | null) {
  if (!value) return null
  return Math.floor((Date.now() - new Date(value).getTime()) / 86400000)
}

export function AdminClient() {
  const [data, setData] = useState<Overview | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    apiFetch<Overview>("/api/admin/overview")
      .then((overview) => {
        if (!cancelled) setData(overview)
      })
      .catch((error) => {
        if (!cancelled) toast.error(error instanceof Error ? error.message : "加载失败")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [refreshKey])

  const stats = useMemo(() => {
    const users = data?.users ?? []
    return {
      users: users.length,
      admins: users.filter((user) => user.role === "admin" || user.role === "owner").length,
      pending: (data?.requests.length ?? 0) + (data?.passwordRequests.length ?? 0),
    }
  }, [data])

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

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-10">
      <div className="mb-8">
        <h1 className="text-xl font-semibold mb-1">管理员控制台</h1>
        <p className="text-sm text-[--color-text-muted]">审核注册、管理成员权限，并查看近期登录和操作行为。</p>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-8">
        <div className="border border-[--color-border] rounded-[--radius-lg] bg-[--color-bg-surface] p-4">
          <p className="text-xs text-[--color-text-muted] mb-2">待审核</p>
          <p className="text-2xl font-semibold">{stats.pending}</p>
        </div>
        <div className="border border-[--color-border] rounded-[--radius-lg] bg-[--color-bg-surface] p-4">
          <p className="text-xs text-[--color-text-muted] mb-2">成员数</p>
          <p className="text-2xl font-semibold">{stats.users}</p>
        </div>
        <div className="border border-[--color-border] rounded-[--radius-lg] bg-[--color-bg-surface] p-4">
          <p className="text-xs text-[--color-text-muted] mb-2">管理员</p>
          <p className="text-2xl font-semibold">{stats.admins}</p>
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm text-[--color-text-muted]">加载中...</div>
      ) : data && (
        <div className="space-y-8">
          <section>
            <div className="flex items-center gap-2 mb-3">
              <UserCheck size={16} />
              <h2 className="text-sm font-semibold">注册审核</h2>
            </div>
            <div className="border border-[--color-border] rounded-[--radius-lg] overflow-hidden bg-[--color-bg-surface]">
              {data.requests.length === 0 ? (
                <p className="p-4 text-sm text-[--color-text-muted]">暂无待审核申请</p>
              ) : data.requests.map((request) => (
                <div key={request.id} className="flex items-center gap-4 px-4 py-3 border-b border-[--color-border] last:border-b-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{request.displayName}</p>
                    <p className="text-xs text-[--color-text-muted] font-mono break-all">{request.email}</p>
                  </div>
                  <span className="text-xs text-[--color-text-muted]">{formatTime(request.createdAt)}</span>
                  <Button size="sm" onClick={() => approve(request.id)}>同意注册</Button>
                </div>
              ))}
            </div>
          </section>

          <section>
            <div className="flex items-center gap-2 mb-3">
              <KeyRound size={16} />
              <h2 className="text-sm font-semibold">密码修改审核</h2>
            </div>
            <div className="border border-[--color-border] rounded-[--radius-lg] overflow-hidden bg-[--color-bg-surface]">
              {data.passwordRequests.length === 0 ? (
                <p className="p-4 text-sm text-[--color-text-muted]">暂无待审核密码申请</p>
              ) : data.passwordRequests.map((request) => (
                <div key={request.id} className="flex items-center gap-4 px-4 py-3 border-b border-[--color-border] last:border-b-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{request.user.displayName || request.user.email}</p>
                    <p className="text-xs text-[--color-text-muted] font-mono break-all">{request.user.email}</p>
                  </div>
                  <span className="text-xs text-[--color-text-muted]">{formatTime(request.requestedAt)}</span>
                  <Button size="sm" onClick={() => approvePassword(request.id)}>同意修改</Button>
                </div>
              ))}
            </div>
          </section>

          <section>
            <div className="flex items-center gap-2 mb-3">
              <UserCog size={16} />
              <h2 className="text-sm font-semibold">用户管理</h2>
            </div>
            <div className="border border-[--color-border] rounded-[--radius-lg] overflow-x-auto bg-[--color-bg-surface]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-[--color-border-strong] bg-[--color-bg-hover]">
                    <th className="text-left px-4 py-2.5 font-medium text-xs text-[--color-text-muted]">用户</th>
                    <th className="text-left px-4 py-2.5 font-medium text-xs text-[--color-text-muted] w-[130px]">权限</th>
                    <th className="text-left px-4 py-2.5 font-medium text-xs text-[--color-text-muted] w-[180px]">最近登录</th>
                    <th className="text-left px-4 py-2.5 font-medium text-xs text-[--color-text-muted] w-[150px]">删除条件</th>
                    {data.canManageUsers && <th className="px-4 py-2.5 w-[80px]" />}
                  </tr>
                </thead>
                <tbody>
                  {data.users.map((user) => {
                    const inactiveDays = daysSince(user.lastLoginAt)
                    const deletable = inactiveDays !== null && inactiveDays >= 30
                    return (
                      <tr key={user.id} className="border-b border-[--color-border] last:border-b-0">
                        <td className="px-4 py-3">
                          <p className="font-medium">{user.displayName || user.email}</p>
                          <p className="text-xs text-[--color-text-muted] font-mono break-all">{user.email}</p>
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
            </div>
          </section>

          <section>
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck size={16} />
              <h2 className="text-sm font-semibold">最近登录和操作行为</h2>
            </div>
            <div className="border border-[--color-border] rounded-[--radius-lg] overflow-hidden bg-[--color-bg-surface]">
              {data.activities.length === 0 ? (
                <p className="p-4 text-sm text-[--color-text-muted]">暂无行为记录</p>
              ) : data.activities.map((activity) => (
                <div key={activity.id} className="grid md:grid-cols-[180px_180px_1fr] gap-2 px-4 py-3 border-b border-[--color-border] last:border-b-0 text-sm">
                  <span className="text-xs text-[--color-text-muted]">{formatTime(activity.createdAt)}</span>
                  <span className="text-xs font-mono text-[--color-text-secondary]">{activity.action}</span>
                  <span className="text-xs text-[--color-text-muted]">
                    {(activity.user?.displayName || activity.user?.email || "系统")}：{activity.detail}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
