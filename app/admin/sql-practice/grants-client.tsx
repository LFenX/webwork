"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { ArrowLeft, ShieldCheck } from "lucide-react"
import { Input } from "@/components/ui/input"
import { apiFetch, apiPatch } from "@/lib/api-client"
import { formatChinaDateTime } from "@/lib/time"
import { ModuleHero, ModulePageShell, ModulePanel } from "@/components/module/module-shell"
import { ModuleContentLoading } from "@/components/loading/app-loading-states"

type GrantRow = {
  userId: string
  email: string
  displayName: string
  role: string
  enabled: boolean
  note: string
  updatedAt: string | null
}

export function SqlPracticeGrantsClient() {
  const [rows, setRows] = useState<GrantRow[]>([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [filter, setFilter] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiFetch<{ items: GrantRow[] }>("/api/admin/sql-practice/grants")
      setRows(res.items)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "加载失败")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch on mount
    void load()
  }, [load])

  async function toggle(row: GrantRow, enabled: boolean, note?: string) {
    setSavingId(row.userId)
    try {
      await apiPatch(`/api/admin/sql-practice/grants/${row.userId}`, {
        enabled,
        note: note ?? row.note,
      })
      toast.success(enabled ? "已开通" : "已停用")
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "保存失败")
    } finally {
      setSavingId(null)
    }
  }

  const filtered = rows.filter((r) => {
    const f = filter.trim().toLowerCase()
    if (!f) return true
    return r.email.toLowerCase().includes(f) || r.displayName.toLowerCase().includes(f)
  })

  return (
    <ModulePageShell maxWidth="content">
      <ModuleHero
        icon={ShieldCheck}
        eyebrow="Owner"
        title="SQL 练题 — 成员授权"
        description="只有被开通的成员才能在自己账号里看到 SQL 练题模块。每个人只能看到自己的记录。"
        actions={
          <Link
            href="/sql-practice"
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600 hover:no-underline"
          >
            <ArrowLeft size={14} />
            返回练题
          </Link>
        }
      />

      <div className="mt-5">
        <ModulePanel
          title="所有成员"
          description={loading ? "同步中" : `${filtered.length} 人`}
          action={
            <Input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="搜索邮箱 / 昵称"
              className="h-9 w-[220px]"
            />
          }
          contentClassName="p-0"
        >
          {loading ? <ModuleContentLoading rows={8} /> : null}
          <div className="divide-y divide-slate-100">
            {filtered.length === 0 && !loading && (
              <div className="px-5 py-10 text-center text-sm text-slate-400">没有匹配的成员</div>
            )}
            {!loading && filtered.map((row) => (
              <GrantRowItem
                key={row.userId}
                row={row}
                disabled={savingId === row.userId}
                onToggle={(enabled, note) => toggle(row, enabled, note)}
              />
            ))}
          </div>
        </ModulePanel>
      </div>
    </ModulePageShell>
  )
}

function GrantRowItem({
  row,
  disabled,
  onToggle,
}: {
  row: GrantRow
  disabled: boolean
  onToggle: (enabled: boolean, note?: string) => void
}) {
  const [note, setNote] = useState(row.note)
  return (
    <div className="flex flex-col gap-3 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-slate-900">{row.displayName || row.email}</span>
          <span className="text-xs text-slate-400">{row.email}</span>
          {row.role === "admin" && (
            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] text-blue-700">管理员</span>
          )}
          {row.enabled && (
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700">已开通</span>
          )}
        </div>
        {row.updatedAt && (
          <p className="mt-1 text-xs text-slate-400">更新于 {formatChinaDateTime(row.updatedAt)}</p>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="备注（可选）"
          className="h-9 w-[180px]"
        />
        <button
          type="button"
          disabled={disabled}
          onClick={() => onToggle(!row.enabled, note)}
          className={
            row.enabled
              ? "inline-flex h-9 items-center rounded-full border border-rose-200 bg-rose-50 px-3 text-sm font-medium text-rose-700 hover:bg-rose-100 disabled:opacity-50"
              : "inline-flex h-9 items-center rounded-full bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          }
        >
          {row.enabled ? "停用" : "开通"}
        </button>
      </div>
    </div>
  )
}
