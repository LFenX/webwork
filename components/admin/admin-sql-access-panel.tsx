"use client"

import { useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  History as HistoryIcon,
  Lock,
  Plus,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  Users as UsersIcon,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { apiDelete, apiFetch, apiPatch } from "@/lib/api-client"
import { cn } from "@/lib/utils"
import { formatChinaDateTime } from "@/lib/time"
import type {
  SqlAccessLevel,
  SqlAuditEntry,
  SqlGrant,
  SqlGrantSummary,
  SqlGrantTable,
} from "@/lib/sql-lab/types"

type AllTable = { schema: string; table: string; columns: string[] }

const ACCESS_LABEL: Record<SqlAccessLevel, string> = {
  none: "无权限",
  read: "只读",
  write: "可写",
}

const ACCESS_CHIP: Record<SqlAccessLevel, string> = {
  none: "border-zinc-200 bg-zinc-50 text-zinc-500",
  read: "border-sky-200 bg-sky-50 text-sky-700",
  write: "border-emerald-200 bg-emerald-50 text-emerald-700",
}

export function AdminSqlAccessPanel() {
  const [summaries, setSummaries] = useState<SqlGrantSummary[]>([])
  const [allTables, setAllTables] = useState<AllTable[]>([])
  const [audit, setAudit] = useState<SqlAuditEntry[]>([])
  const [editingUserId, setEditingUserId] = useState<string | null>(null)
  const [grant, setGrant] = useState<SqlGrant | null>(null)
  const [loading, setLoading] = useState(true)
  const [savingTable, setSavingTable] = useState<string | null>(null)
  const [filter, setFilter] = useState("")
  const [showAddTable, setShowAddTable] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [users, tables, auditPage] = await Promise.all([
          apiFetch<{ items: SqlGrantSummary[] }>("/api/admin/sql-access/users"),
          apiFetch<{ items: AllTable[] }>("/api/admin/sql-access/tables"),
          apiFetch<{ items: SqlAuditEntry[] }>("/api/admin/sql-access/audit"),
        ])
        if (cancelled) return
        setSummaries(users.items ?? [])
        setAllTables(tables.items ?? [])
        setAudit(auditPage.items ?? [])
      } catch (error) {
        if (!cancelled) toast.error(error instanceof Error ? error.message : "加载失败")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!editingUserId) return
    let cancelled = false
    async function load() {
      try {
        const detail = await apiFetch<SqlGrant>(`/api/admin/sql-access/users/${editingUserId}`)
        if (!cancelled) setGrant(detail)
      } catch (error) {
        if (!cancelled) toast.error(error instanceof Error ? error.message : "加载失败")
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [editingUserId])

  const filteredSummaries = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return summaries
    return summaries.filter(
      (s) =>
        s.email.toLowerCase().includes(q) ||
        s.displayName.toLowerCase().includes(q) ||
        s.role.toLowerCase().includes(q)
    )
  }, [filter, summaries])

  async function toggleEnabled(userId: string, enabled: boolean) {
    try {
      const updated = await apiPatch<SqlGrant>(`/api/admin/sql-access/users/${userId}`, { enabled })
      setSummaries((prev) =>
        prev.map((s) =>
          s.userId === userId ? { ...s, enabled: updated.enabled, updatedAt: updated.updatedAt } : s
        )
      )
      if (grant?.userId === userId) setGrant({ ...grant, enabled: updated.enabled })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "更新失败")
    }
  }

  async function patchTableGrant(table: SqlGrantTable, patch: Partial<SqlGrantTable>) {
    if (!grant) return
    const key = `${table.schema}.${table.table}`
    setSavingTable(key)
    const next: SqlGrantTable = { ...table, ...patch, updatedAt: new Date().toISOString() }
    setGrant((prev) =>
      prev ? { ...prev, tables: prev.tables.map((t) => (t.schema === table.schema && t.table === table.table ? next : t)) } : prev
    )
    try {
      await apiPatch(`/api/admin/sql-access/users/${grant.userId}/tables/${key}`, {
        access: next.access,
        blockedColumns: next.blockedColumns,
        rowFilter: next.rowFilter ?? null,
      })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存失败")
    } finally {
      setSavingTable(null)
    }
  }

  async function removeTableGrant(table: SqlGrantTable) {
    if (!grant) return
    if (!window.confirm(`移除对 ${table.schema}.${table.table} 的访问?`)) return
    try {
      await apiDelete(`/api/admin/sql-access/users/${grant.userId}/tables/${table.schema}.${table.table}`)
      setGrant({ ...grant, tables: grant.tables.filter((t) => !(t.schema === table.schema && t.table === table.table)) })
      setSummaries((prev) =>
        prev.map((s) =>
          s.userId === grant.userId
            ? { ...s, tableCount: Math.max(0, s.tableCount - 1) }
            : s
        )
      )
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "删除失败")
    }
  }

  async function addTable(schema: string, table: string) {
    if (!grant) return
    if (grant.tables.some((t) => t.schema === schema && t.table === table)) return
    const next: SqlGrantTable = {
      schema,
      table,
      access: "read",
      blockedColumns: [],
      updatedAt: new Date().toISOString(),
    }
    setGrant({ ...grant, tables: [...grant.tables, next] })
    setShowAddTable(false)
    try {
      await apiPatch(`/api/admin/sql-access/users/${grant.userId}/tables/${schema}.${table}`, {
        access: "read",
        blockedColumns: [],
        rowFilter: null,
      })
      setSummaries((prev) =>
        prev.map((s) => (s.userId === grant.userId ? { ...s, tableCount: s.tableCount + 1, readOnlyCount: s.readOnlyCount + 1 } : s))
      )
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存失败")
    }
  }

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Database size={16} className="text-[--color-brand]" />
        <h2 className="text-sm font-semibold">SQL 实验室访问</h2>
        <span className="text-[11px] text-[--color-text-muted]">
          为成员开放数据库表读取或写入权限,可逐表配置受限列与行过滤
        </span>
        <div className="ml-auto">
          <label className="flex items-center gap-1.5 rounded-[--radius-sm] border border-[--color-border] bg-[--color-bg-soft] px-2.5 py-1.5">
            <Search size={12} className="text-[--color-text-muted]" />
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="搜索成员"
              className="w-44 bg-transparent text-xs outline-none placeholder:text-[--color-text-muted]"
            />
          </label>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr]">
        {/* 用户列表 */}
        <div className="overflow-hidden rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface]">
          <div className="flex items-center justify-between border-b border-[--color-border] px-4 py-2 text-xs text-[--color-text-muted]">
            <span className="inline-flex items-center gap-1.5">
              <UsersIcon size={12} /> 成员授权一览
            </span>
            <span>{filteredSummaries.length} 人</span>
          </div>
          <div className="max-h-[440px] overflow-y-auto">
            {loading ? (
              <p className="px-4 py-6 text-sm text-[--color-text-muted]">加载中…</p>
            ) : filteredSummaries.length === 0 ? (
              <p className="px-4 py-6 text-sm text-[--color-text-muted]">暂无成员匹配</p>
            ) : (
              <ul>
                {filteredSummaries.map((s) => (
                  <li
                    key={s.userId}
                    className="flex flex-wrap items-center gap-3 border-b border-[--color-border] px-4 py-3 last:border-b-0"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-[--color-text-primary]">
                        {s.displayName || s.email}
                      </p>
                      <p className="truncate font-mono text-[11px] text-[--color-text-muted]">{s.email}</p>
                    </div>
                    <span className="hidden font-mono text-[11px] text-[--color-text-muted] sm:inline">
                      {s.role}
                    </span>
                    <div className="flex items-center gap-1.5 text-[11px]">
                      <span className="rounded-full border border-sky-200 bg-sky-50 px-1.5 py-0.5 text-sky-700">
                        读 {s.readOnlyCount}
                      </span>
                      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-emerald-700">
                        写 {s.writableCount}
                      </span>
                      <span className="rounded-full border border-[--color-border] bg-[--color-bg-soft] px-1.5 py-0.5 text-[--color-text-muted]">
                        {s.tableCount} 表
                      </span>
                    </div>
                    <label className="flex items-center gap-2 text-[11px] text-[--color-text-muted]">
                      <span>启用</span>
                      <input
                        type="checkbox"
                        checked={s.enabled}
                        onChange={(e) => toggleEnabled(s.userId, e.target.checked)}
                      />
                    </label>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 px-3 text-xs"
                      onClick={() => setEditingUserId(s.userId)}
                    >
                      配置授权
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* 审计 */}
        <div className="overflow-hidden rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface]">
          <div className="flex items-center gap-1.5 border-b border-[--color-border] px-4 py-2 text-xs text-[--color-text-muted]">
            <HistoryIcon size={12} /> 最近执行审计
          </div>
          <div className="max-h-[440px] overflow-y-auto">
            {audit.length === 0 ? (
              <p className="px-4 py-6 text-sm text-[--color-text-muted]">暂无记录</p>
            ) : (
              <ul>
                {audit.map((a) => (
                  <li key={a.id} className="border-b border-[--color-border] px-4 py-3 last:border-b-0">
                    <div className="flex items-center gap-2 text-[11px] text-[--color-text-muted]">
                      <span
                        className={cn(
                          "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-mono",
                          a.ok ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                        )}
                      >
                        {a.ok ? <CheckCircle2 size={10} /> : <AlertTriangle size={10} />}
                        {a.ok ? "OK" : "ERR"}
                      </span>
                      <span className="font-mono">{formatChinaDateTime(a.startedAt)}</span>
                      <span>· {a.durationMs} ms</span>
                      <span>· {a.rowCount} 行</span>
                      {a.truncated ? <span className="text-amber-700">已截断</span> : null}
                      <span className="ml-auto truncate">{a.displayName} · {a.ipAddress}</span>
                    </div>
                    <pre className="mt-1 overflow-hidden whitespace-pre-wrap break-all rounded-[--radius-sm] bg-[--color-bg-soft] px-2 py-1.5 font-mono text-[11px] text-[--color-text-primary]">
                      {a.sqlPreview}
                    </pre>
                    {a.errorMessage ? (
                      <p className="mt-1 text-[11px] text-[--color-danger]">{a.errorMessage}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* 配置弹窗 */}
      <Dialog
        open={Boolean(editingUserId)}
        onOpenChange={(open) => {
          if (!open) {
            setEditingUserId(null)
            setGrant(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              <span className="inline-flex items-center gap-2">
                <ShieldCheck size={14} className="text-[--color-brand]" />
                {grant ? `${grant.displayName || grant.email} 的 SQL 授权` : "SQL 授权"}
              </span>
            </DialogTitle>
            <DialogDescription>
              逐表设置读 / 写权限、要遮罩的列、可选行过滤(如 <code className="rounded bg-[--color-bg-soft] px-1 py-0.5 font-mono text-[11px]">userId = :viewerId</code> 限定本人)。
            </DialogDescription>
          </DialogHeader>

          {grant ? (
            <div className="grid gap-3">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-[--radius-md] border border-[--color-border] bg-[--color-bg-soft] px-3 py-2 text-xs">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={grant.enabled}
                    onChange={(e) => toggleEnabled(grant.userId, e.target.checked)}
                  />
                  <span>启用 SQL 实验室入口</span>
                </label>
                <div className="flex items-center gap-3 text-[--color-text-muted]">
                  <label className="inline-flex items-center gap-1.5">
                    <span>默认 LIMIT</span>
                    <input
                      type="number"
                      min={1}
                      defaultValue={grant.defaultLimit}
                      onBlur={(e) =>
                        apiPatch(`/api/admin/sql-access/users/${grant.userId}`, { defaultLimit: Number(e.target.value) }).catch(() => null)
                      }
                      className="w-20 rounded-[--radius-sm] border border-[--color-border] bg-white px-2 py-1 font-mono text-[11px] text-[--color-text-primary]"
                    />
                  </label>
                  <label className="inline-flex items-center gap-1.5">
                    <span>超时(ms)</span>
                    <input
                      type="number"
                      min={1000}
                      step={500}
                      defaultValue={grant.defaultTimeoutMs}
                      onBlur={(e) =>
                        apiPatch(`/api/admin/sql-access/users/${grant.userId}`, { defaultTimeoutMs: Number(e.target.value) }).catch(() => null)
                      }
                      className="w-24 rounded-[--radius-sm] border border-[--color-border] bg-white px-2 py-1 font-mono text-[11px] text-[--color-text-primary]"
                    />
                  </label>
                </div>
              </div>

              <div className="overflow-hidden rounded-[--radius-md] border border-[--color-border]">
                <div className="flex items-center justify-between border-b border-[--color-border] bg-[--color-bg-soft] px-3 py-2 text-xs text-[--color-text-muted]">
                  <span>已授权的表</span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowAddTable(true)}
                    className="h-7 px-2 text-[11px]"
                  >
                    <Plus size={11} /> 添加表
                  </Button>
                </div>
                <div className="max-h-[55vh] overflow-y-auto">
                  {grant.tables.length === 0 ? (
                    <p className="px-4 py-6 text-center text-xs text-[--color-text-muted]">尚未授权任何表</p>
                  ) : (
                    grant.tables.map((t) => {
                      const key = `${t.schema}.${t.table}`
                      const tableMeta = allTables.find((x) => x.schema === t.schema && x.table === t.table)
                      return (
                        <div key={key} className="border-b border-[--color-border] px-4 py-3 last:border-b-0">
                          <div className="mb-2 flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center gap-1 font-mono text-sm">
                              <Lock size={11} className="text-[--color-text-muted]" />
                              {t.schema}.{t.table}
                            </span>
                            <span className={cn("rounded-full border px-2 py-0.5 text-[10px]", ACCESS_CHIP[t.access])}>
                              {ACCESS_LABEL[t.access]}
                            </span>
                            {savingTable === key ? (
                              <span className="text-[10px] text-[--color-text-muted]">保存中…</span>
                            ) : null}
                            <span className="ml-auto inline-flex items-center gap-1">
                              {(["none", "read", "write"] as SqlAccessLevel[]).map((lvl) => (
                                <button
                                  key={lvl}
                                  type="button"
                                  onClick={() => patchTableGrant(t, { access: lvl })}
                                  className={cn(
                                    "rounded-full px-2 py-0.5 text-[10px] transition-colors",
                                    t.access === lvl
                                      ? "bg-[--color-brand] text-white"
                                      : "bg-[--color-bg-soft] text-[--color-text-muted] hover:bg-[--color-bg-hover]"
                                  )}
                                >
                                  {ACCESS_LABEL[lvl]}
                                </button>
                              ))}
                              <button
                                type="button"
                                onClick={() => removeTableGrant(t)}
                                className="rounded-full p-1 text-[--color-text-muted] hover:bg-[--color-danger-bg] hover:text-[--color-danger]"
                              >
                                <Trash2 size={12} />
                              </button>
                            </span>
                          </div>

                          <div className="grid gap-2 md:grid-cols-2">
                            <div>
                              <label className="mb-1 flex items-center gap-1 text-[11px] font-medium text-[--color-text-secondary]">
                                受限列(用户不可读取)
                              </label>
                              {tableMeta ? (
                                <div className="flex flex-wrap gap-1">
                                  {tableMeta.columns.map((c) => {
                                    const blocked = t.blockedColumns.includes(c)
                                    return (
                                      <button
                                        key={c}
                                        type="button"
                                        onClick={() => {
                                          const next = blocked
                                            ? t.blockedColumns.filter((x) => x !== c)
                                            : [...t.blockedColumns, c]
                                          void patchTableGrant(t, { blockedColumns: next })
                                        }}
                                        className={cn(
                                          "rounded-full border px-2 py-0.5 font-mono text-[10px]",
                                          blocked
                                            ? "border-rose-200 bg-rose-50 text-rose-700 line-through"
                                            : "border-[--color-border] bg-[--color-bg-surface] text-[--color-text-secondary] hover:border-[--color-brand-border]"
                                        )}
                                      >
                                        {c}
                                      </button>
                                    )
                                  })}
                                </div>
                              ) : (
                                <p className="text-[11px] text-[--color-text-muted]">无法读取列结构</p>
                              )}
                            </div>
                            <div>
                              <label className="mb-1 flex items-center gap-1 text-[11px] font-medium text-[--color-text-secondary]">
                                行过滤(可选,SQL 片段)
                              </label>
                              <input
                                defaultValue={t.rowFilter ?? ""}
                                placeholder='例如: "userId" = :viewerId'
                                onBlur={(e) => patchTableGrant(t, { rowFilter: e.target.value || undefined })}
                                className="w-full rounded-[--radius-sm] border border-[--color-border] bg-white px-2 py-1.5 font-mono text-[11px] text-[--color-text-primary] outline-none focus:border-[--color-brand-border]"
                              />
                              <p className="mt-1 text-[10px] text-[--color-text-muted]">
                                后端会将该过滤合并到用户每条 WHERE 子句中,占位符 :viewerId 自动替换。
                              </p>
                            </div>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-[--color-text-muted]">加载授权数据…</p>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingUserId(null)}>
              <Save size={12} /> 完成
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 选表对话框 */}
      <Dialog open={showAddTable} onOpenChange={setShowAddTable}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>添加可访问的表</DialogTitle>
            <DialogDescription>选择要授予 {grant?.displayName} 的表,默认权限为只读。</DialogDescription>
          </DialogHeader>
          <div className="max-h-[55vh] overflow-y-auto">
            {allTables.map((t) => {
              const key = `${t.schema}.${t.table}`
              const already = grant?.tables.some((g) => g.schema === t.schema && g.table === t.table)
              return (
                <button
                  key={key}
                  type="button"
                  disabled={already}
                  onClick={() => addTable(t.schema, t.table)}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 border-b border-[--color-border] px-3 py-2 text-left text-sm last:border-b-0 hover:bg-[--color-bg-hover]",
                    already && "cursor-not-allowed opacity-50"
                  )}
                >
                  <span className="font-mono">{key}</span>
                  <span className="text-[11px] text-[--color-text-muted]">{t.columns.length} 列</span>
                </button>
              )
            })}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  )
}
