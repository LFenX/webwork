"use client"

import { useMemo, useState } from "react"
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  History,
  MessageSquareWarning,
  Pin,
  PinOff,
  Search,
  Share2,
  Sparkles,
  Star,
  Table2,
  Trash2,
  Zap,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type {
  SqlExample,
  SqlHistoryItem,
  SqlRunResult,
  SqlSavedQuery,
} from "@/lib/sql-lab/types"
import { formatChinaDateTime } from "@/lib/time"

type Tab = "results" | "messages" | "history" | "saved" | "examples"
type CodeTheme = "dark" | "light"

type Props = {
  result: SqlRunResult | null
  running: boolean
  history: SqlHistoryItem[]
  saved: SqlSavedQuery[]
  examples: SqlExample[]
  activeTab: Tab
  onActiveTabChange: (tab: Tab) => void
  onLoadSql: (sql: string) => void
  onSaveCurrent: () => void
  onTogglePin: (id: string) => void
  onDeleteSaved: (id: string) => void
  onCopyResult?: () => void
  onExportResult?: (format: "csv" | "json") => void
  currentSql: string
  codeTheme?: CodeTheme
}

function codeBlockClass(theme: CodeTheme = "dark") {
  return theme === "dark"
    ? "bg-[#0B1220] text-[#E2E8F0] hover:bg-[#0F172A]"
    : "bg-[#F8FAFC] text-[--color-text-primary] hover:bg-[#F1F5F9] border border-[--color-border]"
}

function shortPreview(sql: string, n = 90) {
  const s = sql.replace(/\s+/g, " ").trim()
  return s.length > n ? s.slice(0, n) + "…" : s
}

function typeChipClass(type: string) {
  const t = type.toLowerCase()
  if (/(text|char|string|uuid)/.test(t)) return "text-sky-700"
  if (/(int|numeric|decimal|float|double|real|number)/.test(t)) return "text-violet-700"
  if (/(time|date)/.test(t)) return "text-emerald-700"
  if (/(bool)/.test(t)) return "text-amber-700"
  if (/(json|jsonb|array)/.test(t)) return "text-rose-700"
  return "text-slate-500"
}

export function ResultsPanel({
  result,
  running,
  history,
  saved,
  examples,
  activeTab,
  onActiveTabChange,
  onLoadSql,
  onSaveCurrent,
  onTogglePin,
  onDeleteSaved,
  onCopyResult,
  onExportResult,
  currentSql,
  codeTheme = "dark",
}: Props) {
  const [filter, setFilter] = useState("")
  const lastSet = result?.resultSets?.[result.resultSets.length - 1] ?? null

  const filteredRows = useMemo(() => {
    if (!lastSet || !filter.trim()) return lastSet?.rows ?? []
    const q = filter.toLowerCase()
    return lastSet.rows.filter((r) =>
      Object.values(r).some((v) => String(v ?? "").toLowerCase().includes(q))
    )
  }, [lastSet, filter])

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[--radius-md] border border-[--color-border] bg-[--color-bg-surface] shadow-[0_4px_18px_rgba(15,23,42,0.04)]">
      {/* IDE-style underline tabs */}
      <div className="flex shrink-0 items-center gap-0 overflow-x-auto border-b border-[--color-border] bg-[#FAFBFC] px-1">
        <UnderlineTab active={activeTab === "results"} onClick={() => onActiveTabChange("results")} count={lastSet?.rowCount}>
          <Table2 size={11} className="mr-1.5" /> 结果
        </UnderlineTab>
        <UnderlineTab active={activeTab === "messages"} onClick={() => onActiveTabChange("messages")} count={result ? (result.warnings.length + (result.error ? 1 : 0)) : 0} alert={!!result?.error}>
          <MessageSquareWarning size={11} className="mr-1.5" /> 消息
        </UnderlineTab>
        <UnderlineTab active={activeTab === "history"} onClick={() => onActiveTabChange("history")} count={history.length}>
          <History size={11} className="mr-1.5" /> 历史
        </UnderlineTab>
        <UnderlineTab active={activeTab === "saved"} onClick={() => onActiveTabChange("saved")} count={saved.length}>
          <Star size={11} className="mr-1.5" /> 收藏
        </UnderlineTab>
        <UnderlineTab active={activeTab === "examples"} onClick={() => onActiveTabChange("examples")} count={examples.length}>
          <Sparkles size={11} className="mr-1.5" /> 范例
        </UnderlineTab>

        <div className="ml-auto flex items-center gap-1 px-2">
          {activeTab === "results" && lastSet ? (
            <>
              <label className="hidden items-center gap-1 rounded-md border border-[--color-border] bg-white px-2 py-1 sm:flex">
                <Search size={10} className="text-[--color-text-muted]" />
                <input
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder="筛选行"
                  className="w-32 bg-transparent font-mono text-[11px] outline-none placeholder:text-[--color-text-muted]"
                />
              </label>
              <IconBtn onClick={onCopyResult} label="复制 (TSV)"><Copy size={11} /></IconBtn>
              <IconBtn onClick={() => onExportResult?.("csv")} label="导出 CSV">
                <Download size={11} /><span className="ml-0.5 font-mono text-[9px]">CSV</span>
              </IconBtn>
              <IconBtn onClick={() => onExportResult?.("json")} label="导出 JSON">
                <Download size={11} /><span className="ml-0.5 font-mono text-[9px]">JSON</span>
              </IconBtn>
            </>
          ) : null}
          {activeTab === "saved" ? (
            <Button size="sm" variant="outline" onClick={onSaveCurrent} className="h-7 px-2 text-[11px]" disabled={!currentSql.trim()}>
              <Star size={11} /> 收藏当前
            </Button>
          ) : null}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        {activeTab === "results" ? (
          <ResultsTable result={result} rows={filteredRows} running={running} />
        ) : activeTab === "messages" ? (
          <MessagesPane result={result} running={running} />
        ) : activeTab === "history" ? (
          <HistoryPane history={history} onLoadSql={onLoadSql} />
        ) : activeTab === "saved" ? (
          <SavedPane saved={saved} onLoadSql={onLoadSql} onTogglePin={onTogglePin} onDeleteSaved={onDeleteSaved} codeTheme={codeTheme} />
        ) : (
          <ExamplesPane examples={examples} onLoadSql={onLoadSql} codeTheme={codeTheme} />
        )}
      </div>
    </div>
  )
}

function UnderlineTab({
  children,
  active,
  onClick,
  count,
  alert,
}: {
  children: React.ReactNode
  active: boolean
  onClick: () => void
  count?: number
  alert?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex shrink-0 items-center gap-0 px-3 py-2 text-[11px] font-medium tracking-wide transition-colors",
        active ? "text-[--color-text-primary]" : "text-[--color-text-muted] hover:text-[--color-text-secondary]"
      )}
    >
      {children}
      {typeof count === "number" && count > 0 ? (
        <span
          className={cn(
            "ml-1.5 rounded px-1 py-px font-mono text-[9px] tabular-nums",
            alert ? "bg-rose-100 text-rose-700" : active ? "bg-[--color-brand-soft] text-[--color-brand]" : "bg-[--color-bg-hover] text-[--color-text-muted]"
          )}
        >
          {count}
        </span>
      ) : null}
      <span
        className={cn(
          "absolute inset-x-2 -bottom-px h-[2px] rounded-full transition-all",
          active ? "bg-[--color-brand]" : "bg-transparent"
        )}
      />
    </button>
  )
}

function IconBtn({ children, onClick, label }: { children: React.ReactNode; onClick?: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className="inline-flex h-7 items-center gap-0.5 rounded-md border border-transparent px-1.5 text-[11px] text-[--color-text-secondary] hover:border-[--color-border] hover:bg-white hover:text-[--color-text-primary]"
    >
      {children}
    </button>
  )
}

function ResultsTable({
  result,
  rows,
  running,
}: {
  result: SqlRunResult | null
  rows: Array<Record<string, unknown>>
  running: boolean
}) {
  if (running) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-[12px] text-[--color-text-muted]">
        <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-[--color-border] border-t-[--color-brand]" />
        <span className="font-mono">executing…</span>
      </div>
    )
  }
  if (!result) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-slate-900 text-white">
          <Zap size={14} />
        </span>
        <p className="text-[13px] font-medium text-[--color-text-primary]">写一段 SQL,Cmd / Ctrl + Enter 立即运行</p>
        <p className="font-mono text-[10px] text-[--color-text-muted]">查询会按当前账号的访问授权自动过滤</p>
      </div>
    )
  }
  if (!result.ok) {
    return (
      <div className="flex h-full flex-col gap-2 overflow-y-auto p-5">
        <div className="inline-flex items-center gap-2 self-start rounded-md border border-rose-200 bg-rose-50 px-2 py-1 font-mono text-[11px] text-rose-700">
          <AlertTriangle size={11} />
          {result.error?.code ?? "ERROR"}
        </div>
        <p className="text-[13px] text-[--color-text-primary]">{result.error?.message}</p>
        {result.error?.hint ? (
          <p className="rounded-md bg-[--color-bg-soft] px-3 py-2 font-mono text-[11px] text-[--color-text-muted]">
            hint · {result.error.hint}
          </p>
        ) : null}
      </div>
    )
  }
  const set = result.resultSets[result.resultSets.length - 1]
  if (!set || set.columns.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center font-mono text-[12px] text-[--color-text-muted]">
        <CheckCircle2 size={16} className="text-emerald-600" />
        语句执行成功 {typeof set?.affectedRows === "number" ? `· 影响 ${set.affectedRows} 行` : ""}
      </div>
    )
  }
  return (
    <div className="flex h-full flex-col">
      {/* status line - VS Code-ish */}
      <div className="flex shrink-0 items-center gap-3 border-b border-[--color-border] bg-[#F8FAFC] px-3 py-1 font-mono text-[10.5px] text-[--color-text-muted]">
        <span className="inline-flex items-center gap-1 text-emerald-700">
          <CheckCircle2 size={10} />
          <span className="tabular-nums">{set.rowCount}</span> rows
        </span>
        <span className="text-slate-300">│</span>
        <span className="inline-flex items-center gap-1">
          <Clock size={10} />
          <span className="tabular-nums">{result.durationMs}</span> ms
        </span>
        {set.truncated ? (
          <>
            <span className="text-slate-300">│</span>
            <span className="inline-flex items-center gap-1 text-amber-700">
              <AlertTriangle size={10} /> truncated
            </span>
          </>
        ) : null}
        {result.touchedTables?.length ? (
          <>
            <span className="text-slate-300">│</span>
            <span>read: <span className="text-[--color-text-primary]">{result.touchedTables.join(", ")}</span></span>
          </>
        ) : null}
        <span className="ml-auto text-[--color-text-muted]">runId · {result.runId}</span>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full border-separate border-spacing-0 font-mono text-[11.5px]">
          <thead className="sticky top-0 z-10">
            <tr>
              <th className="sticky left-0 z-20 w-10 border-b border-r border-[--color-border] bg-[#F1F5F9] px-2 py-1.5 text-right text-[10px] font-semibold text-[--color-text-muted] tabular-nums">
                #
              </th>
              {set.columns.map((c) => (
                <th
                  key={c.name}
                  className="border-b border-r border-[--color-border] bg-[#F8FAFC] px-3 py-1.5 text-left font-semibold text-[--color-text-primary] last:border-r-0"
                >
                  <div className="flex items-baseline gap-2">
                    <span className="text-[11.5px]">{c.name}</span>
                    <span className={cn("text-[9px] uppercase tracking-wider", typeChipClass(c.type))}>
                      {c.type}
                    </span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="group hover:bg-[#EFF6FF]">
                <td className="sticky left-0 z-10 w-10 border-b border-r border-[--color-border] bg-[#F8FAFC] px-2 py-1 text-right text-[10px] text-[--color-text-muted] tabular-nums group-hover:bg-[#E0F2FE]">
                  {i + 1}
                </td>
                {set.columns.map((c) => {
                  const v = row[c.name]
                  return (
                    <td
                      key={c.name}
                      className="max-w-[360px] truncate border-b border-r border-[--color-border] px-3 py-1 text-[--color-text-primary] last:border-r-0"
                      title={v === null || v === undefined ? "NULL" : String(v)}
                    >
                      {v === null || v === undefined ? (
                        <span className="italic text-[--color-text-muted]">NULL</span>
                      ) : typeof v === "boolean" ? (
                        <span className={cn("font-medium", v ? "text-emerald-700" : "text-rose-700")}>{String(v)}</span>
                      ) : typeof v === "number" ? (
                        <span className="tabular-nums text-violet-700">{v}</span>
                      ) : (
                        String(v)
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={set.columns.length + 1} className="px-4 py-6 text-center font-sans text-[11px] text-[--color-text-muted]">
                  没有匹配的行
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function MessagesPane({ result, running }: { result: SqlRunResult | null; running: boolean }) {
  if (running) {
    return <div className="px-6 py-6 font-mono text-[12px] text-[--color-text-muted]">executing…</div>
  }
  if (!result) {
    return <div className="px-6 py-6 font-mono text-[12px] text-[--color-text-muted]">尚未运行任何语句</div>
  }
  return (
    <div className="space-y-2 overflow-y-auto p-3 font-mono text-[11.5px]">
      <div className="flex items-center gap-2 rounded-md border border-[--color-border] bg-[#F8FAFC] px-3 py-2 text-[--color-text-muted]">
        <Clock size={11} className="text-[--color-text-muted]" />
        <span>{formatChinaDateTime(result.startedAt)}</span>
        <span className="text-slate-300">│</span>
        <span>{result.durationMs} ms</span>
        <span className="text-slate-300">│</span>
        <span>runId {result.runId}</span>
      </div>
      {result.error ? (
        <div className="flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700">
          <AlertTriangle size={12} className="mt-0.5 shrink-0" />
          <div>
            <div className="font-semibold">{result.error.code}</div>
            <div>{result.error.message}</div>
            {result.error.hint ? <div className="mt-1 text-[--color-text-muted]">hint · {result.error.hint}</div> : null}
          </div>
        </div>
      ) : null}
      {result.warnings.map((w, i) => (
        <div key={i} className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">
          <MessageSquareWarning size={12} className="mt-0.5 shrink-0" />
          {w}
        </div>
      ))}
      {result.ok ? (
        <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-700">
          <CheckCircle2 size={12} /> Statement executed successfully
        </div>
      ) : null}
    </div>
  )
}

function HistoryPane({ history, onLoadSql }: { history: SqlHistoryItem[]; onLoadSql: (sql: string) => void }) {
  if (history.length === 0) {
    return <div className="px-6 py-6 font-mono text-[12px] text-[--color-text-muted]">还没有运行记录</div>
  }
  return (
    <div className="overflow-y-auto p-2">
      {history.map((h) => (
        <button
          key={h.id}
          type="button"
          onClick={() => onLoadSql(h.sql)}
          className="mb-1 block w-full rounded-md border border-transparent px-3 py-2 text-left transition-colors hover:border-[--color-border] hover:bg-[#F8FAFC]"
        >
          <div className="flex items-center gap-2 font-mono text-[10.5px] text-[--color-text-muted]">
            <span
              className={cn(
                "inline-flex items-center gap-0.5 rounded px-1 py-px font-semibold",
                h.ok ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
              )}
            >
              {h.ok ? <CheckCircle2 size={9} /> : <AlertTriangle size={9} />}
              {h.ok ? "OK" : "ERR"}
            </span>
            <span className="tabular-nums">{h.durationMs}ms</span>
            <span>·</span>
            <span className="tabular-nums">{h.rowCount} rows</span>
            <span className="ml-auto">{formatChinaDateTime(h.startedAt)}</span>
          </div>
          <div className="mt-1 line-clamp-2 font-mono text-[11.5px] text-[--color-text-primary]">{shortPreview(h.sql, 240)}</div>
          {h.errorMessage ? <div className="mt-0.5 font-mono text-[10.5px] text-rose-700">{h.errorMessage}</div> : null}
        </button>
      ))}
    </div>
  )
}

function SavedPane({
  saved,
  onLoadSql,
  onTogglePin,
  onDeleteSaved,
  codeTheme = "dark",
}: {
  saved: SqlSavedQuery[]
  onLoadSql: (sql: string) => void
  onTogglePin: (id: string) => void
  onDeleteSaved: (id: string) => void
  codeTheme?: CodeTheme
}) {
  if (saved.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center text-sm text-[--color-text-muted]">
        <Star size={18} />
        <span className="text-[12px]">还没有收藏的查询</span>
        <span className="font-mono text-[10px]">点击右上角 &ldquo;收藏当前&rdquo; 保存常用 SQL</span>
      </div>
    )
  }
  const sorted = [...saved].sort((a, b) => Number(b.pinned) - Number(a.pinned))
  return (
    <div className="overflow-y-auto p-2">
      {sorted.map((s) => (
        <div key={s.id} className="group mb-1 rounded-md border border-transparent px-3 py-2 hover:border-[--color-border] hover:bg-[#F8FAFC]">
          <div className="flex items-center gap-2">
            {s.pinned ? <Pin size={10} className="text-[--color-brand]" /> : null}
            <span className="text-[12px] font-medium text-[--color-text-primary]">{s.name}</span>
            {s.shared ? (
              <span className="inline-flex items-center gap-0.5 rounded bg-violet-50 px-1 py-px font-mono text-[9px] text-violet-700">
                <Share2 size={8} /> shared
              </span>
            ) : null}
            <span className="ml-auto flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
              <button
                type="button"
                onClick={() => onTogglePin(s.id)}
                className="rounded-md p-1 text-[--color-text-muted] hover:bg-[--color-bg-hover] hover:text-[--color-brand]"
                title={s.pinned ? "取消置顶" : "置顶"}
              >
                {s.pinned ? <PinOff size={10} /> : <Pin size={10} />}
              </button>
              <button
                type="button"
                onClick={() => onDeleteSaved(s.id)}
                className="rounded-md p-1 text-[--color-text-muted] hover:bg-rose-50 hover:text-rose-700"
                title="删除"
              >
                <Trash2 size={10} />
              </button>
            </span>
          </div>
          {s.description ? <p className="mt-0.5 font-mono text-[10.5px] text-[--color-text-muted]">{s.description}</p> : null}
          <button
            type="button"
            onClick={() => onLoadSql(s.sql)}
            className={cn(
              "mt-1.5 block w-full rounded-md px-2 py-1.5 text-left font-mono text-[10.5px] leading-relaxed",
              codeBlockClass(codeTheme)
            )}
          >
            {shortPreview(s.sql, 200)}
          </button>
        </div>
      ))}
    </div>
  )
}

function ExamplesPane({
  examples,
  onLoadSql,
  codeTheme = "dark",
}: {
  examples: SqlExample[]
  onLoadSql: (sql: string) => void
  codeTheme?: CodeTheme
}) {
  if (examples.length === 0) {
    return <div className="px-6 py-6 font-mono text-[12px] text-[--color-text-muted]">暂无范例</div>
  }
  return (
    <div className="overflow-y-auto p-3">
      <div className="grid gap-2 md:grid-cols-2">
        {examples.map((ex) => (
          <button
            key={ex.id}
            type="button"
            onClick={() => onLoadSql(ex.sql)}
            className="overflow-hidden rounded-md border border-[--color-border] bg-[--color-bg-surface] text-left transition-all hover:-translate-y-px hover:border-[--color-brand-border] hover:shadow-[0_8px_24px_rgba(15,23,42,0.06)]"
          >
            <div className="flex items-center gap-2 border-b border-[--color-border] bg-[#F8FAFC] px-3 py-1.5">
              <span className="rounded bg-[--color-brand-soft] px-1.5 py-px font-mono text-[9px] uppercase tracking-wider text-[--color-brand]">
                {ex.category}
              </span>
              <span className="text-[12px] font-medium text-[--color-text-primary]">{ex.title}</span>
            </div>
            <p className="px-3 pt-2 font-mono text-[10.5px] text-[--color-text-muted]">{ex.description}</p>
            <pre className={cn("mx-3 my-2 max-h-28 overflow-hidden rounded p-2 font-mono text-[10.5px] leading-relaxed", codeBlockClass(codeTheme))}>
              {ex.sql}
            </pre>
          </button>
        ))}
      </div>
    </div>
  )
}
