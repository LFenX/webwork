"use client"

import { type ReactNode, useMemo, useState } from "react"
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Copy,
  Download,
  History,
  Pin,
  PinOff,
  Search,
  Sparkles,
  Star,
  Table2,
  Trash2,
  Wrench,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ChartPanel } from "@/components/sql-lab/visualization/chart-panel"
import type { SqlExample, SqlHistoryItem, SqlRunResult, SqlSavedQuery } from "@/lib/sql-lab/types"
import { formatChinaDateTime } from "@/lib/time"

type Tab = "results" | "history" | "saved" | "examples"
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
  onRepairError?: (input: { sql: string; error: NonNullable<SqlRunResult["error"]> }) => void
  currentSql: string
  codeTheme?: CodeTheme
}

function shortPreview(sql: string, n = 110) {
  const text = sql.replace(/\s+/g, " ").trim()
  return text.length > n ? `${text.slice(0, n)}...` : text
}

function formatCell(value: unknown) {
  if (value === null || value === undefined) return ""
  if (typeof value === "object") return JSON.stringify(value)
  return String(value)
}

function typeClass(type: string) {
  const lower = type.toLowerCase()
  if (/(int|numeric|decimal|float|double|real|number)/.test(lower)) return "is-violet"
  if (/(time|date)/.test(lower)) return "is-emerald"
  if (/(bool)/.test(lower)) return "is-amber"
  if (/(json|array)/.test(lower)) return "is-rose"
  return "is-sky"
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
  onRepairError,
  currentSql,
}: Props) {
  const [filter, setFilter] = useState("")
  const [viewMode, setViewMode] = useState<"table" | "chart">("table")
  const lastSet = result?.resultSets?.[result.resultSets.length - 1] ?? null
  const chartKey = lastSet ? lastSet.columns.map((column) => `${column.name}:${column.type}`).join("|") : "empty"
  const filteredRows = useMemo(() => {
    if (!lastSet || !filter.trim()) return lastSet?.rows ?? []
    const q = filter.toLowerCase()
    return lastSet.rows.filter((row) => Object.values(row).some((value) => String(value ?? "").toLowerCase().includes(q)))
  }, [filter, lastSet])

  return (
    <section className="sql-lab-results-board">
      <div className="sql-lab-results-head">
        <div className="sql-lab-results-title">
          <span><BarChart3 size={18} /></span>
          <div>
            <h2>结果洞察</h2>
            <p>{lastSet ? `${lastSet.rowCount} 行结果 · ${result?.durationMs ?? 0}ms` : "运行后会在这里沉淀图表、表格、消息和历史"}</p>
          </div>
        </div>
        <div className="sql-lab-results-tabs" role="tablist" aria-label="SQL 结果视图">
          <ResultTab icon={<Table2 size={14} />} label="结果" active={activeTab === "results"} count={lastSet?.rowCount} onClick={() => onActiveTabChange("results")} />
          <ResultTab icon={<History size={14} />} label="历史" active={activeTab === "history"} count={history.length} onClick={() => onActiveTabChange("history")} />
          <ResultTab icon={<Star size={14} />} label="配方" active={activeTab === "saved"} count={saved.length} onClick={() => onActiveTabChange("saved")} />
          <ResultTab icon={<Sparkles size={14} />} label="示例" active={activeTab === "examples"} count={examples.length} onClick={() => onActiveTabChange("examples")} />
        </div>
      </div>

      {activeTab === "results" && lastSet ? (
        <div className="sql-lab-results-actions">
          <div className="sql-lab-result-view-toggle" role="tablist" aria-label="结果视图">
            <button type="button" className={cn(viewMode === "table" && "is-active")} onClick={() => setViewMode("table")}>表格</button>
            <button type="button" className={cn(viewMode === "chart" && "is-active")} onClick={() => setViewMode("chart")}>图表</button>
          </div>
          <label className="sql-lab-result-filter">
            <Search size={14} />
            <input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="筛选结果行" />
          </label>
          <button type="button" onClick={onCopyResult}><Copy size={14} /> 复制</button>
          <button type="button" onClick={() => onExportResult?.("csv")}><Download size={14} /> CSV</button>
          <button type="button" onClick={() => onExportResult?.("json")}><Download size={14} /> JSON</button>
        </div>
      ) : activeTab === "saved" ? (
        <div className="sql-lab-results-actions">
          <Button size="sm" variant="outline" onClick={onSaveCurrent} disabled={!currentSql.trim()} className="h-8 rounded-full text-xs">
            <Star size={13} /> 保存当前 SQL
          </Button>
        </div>
      ) : null}

      <div className="sql-lab-results-content">
        {activeTab === "results" ? (
          viewMode === "chart" && lastSet && result?.ok ? (
            <ChartPanel key={chartKey} columns={lastSet.columns} rows={filteredRows} sql={currentSql || lastSet.statement} title="结果图表" />
          ) : (
            <ResultsTable result={result} running={running} rows={filteredRows} currentSql={currentSql} onRepairError={onRepairError} />
          )
        ) : activeTab === "history" ? (
          <HistoryPane history={history} onLoadSql={onLoadSql} />
        ) : activeTab === "saved" ? (
          <SavedPane saved={saved} onLoadSql={onLoadSql} onTogglePin={onTogglePin} onDeleteSaved={onDeleteSaved} />
        ) : (
          <ExamplesPane examples={examples} onLoadSql={onLoadSql} />
        )}
      </div>
    </section>
  )
}

function ResultTab({
  icon,
  label,
  active,
  count,
  alert,
  onClick,
}: {
  icon: ReactNode
  label: string
  active: boolean
  count?: number
  alert?: boolean
  onClick: () => void
}) {
  return (
    <button type="button" role="tab" aria-selected={active} onClick={onClick} className={cn("sql-lab-result-tab", active && "is-active", alert && "is-alert")}>
      {icon}
      <span>{label}</span>
      {typeof count === "number" && count > 0 ? <em>{count > 999 ? "999+" : count}</em> : null}
    </button>
  )
}

function ResultsTable({
  result,
  rows,
  running,
  currentSql,
  onRepairError,
}: {
  result: SqlRunResult | null
  rows: Array<Record<string, unknown>>
  running: boolean
  currentSql: string
  onRepairError?: Props["onRepairError"]
}) {
  const lastSet = result?.resultSets?.[result.resultSets.length - 1] ?? null
  if (running) {
    return (
      <div className="sql-lab-result-empty is-running">
        <span className="sql-lab-running-orb" />
        <strong>正在运行查询</strong>
        <small>SQL Lab 会按当前账号权限、limit 和超时策略执行。</small>
      </div>
    )
  }
  if (result && !result.ok) {
    return (
      <div className="sql-lab-message-list">
        <div className="sql-lab-error-card">
          <AlertTriangle size={18} />
          <div>
            <strong>{result.error?.code ?? "ERROR"}</strong>
            <p>{result.error?.message ?? "SQL 执行失败"}</p>
            {result.error?.hint ? <small>{result.error.hint}</small> : null}
            {currentSql.trim() && result.error ? (
              <button
                type="button"
                className="sql-stage-inline-action is-repair"
                onClick={() => onRepairError?.({ sql: currentSql, error: result.error as NonNullable<SqlRunResult["error"]> })}
              >
                <Wrench size={13} /> 按错误修复
              </button>
            ) : null}
          </div>
        </div>
      </div>
    )
  }
  if (!result || !lastSet) {
    return (
      <div className="sql-lab-result-empty">
        <Sparkles size={24} />
        <strong>还没有结果</strong>
        <small>从洞察任务台发起分析，或展开 SQL 控制台手写查询。</small>
      </div>
    )
  }
  if (!result.ok) {
    return (
      <div className="sql-lab-message-list">
        <div className="sql-lab-error-card">
          <AlertTriangle size={18} />
          <div>
            <strong>{result.error?.code ?? "ERROR"}</strong>
            <p>{result.error?.message ?? "SQL 执行失败"}</p>
            {result.error?.hint ? <small>{result.error.hint}</small> : null}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="sql-lab-table-wrap">
      <div className="sql-lab-result-summary-grid">
        <SummaryMetric label="结果行数" value={String(lastSet.rowCount)} tone="is-sky" />
        <SummaryMetric label="字段数量" value={String(lastSet.columns.length)} tone="is-violet" />
        <SummaryMetric label="执行耗时" value={`${result.durationMs}ms`} tone="is-emerald" />
        <SummaryMetric label="消息状态" value={result.warnings.length ? `${result.warnings.length} 条` : "正常"} tone={result.warnings.length ? "is-amber" : "is-cyan"} />
      </div>
      <table className="sql-lab-result-table">
        <thead>
          <tr>
            {lastSet.columns.map((column) => (
              <th key={column.name}>
                <span>{column.name}</span>
                <em className={typeClass(column.type)}>{column.type}</em>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 100).map((row, rowIndex) => (
            <tr key={rowIndex}>
              {lastSet.columns.map((column) => (
                <td key={column.name}>{formatCell(row[column.name])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > 100 ? <div className="sql-lab-table-foot">当前预览前 100 行，可导出完整结果。</div> : null}
    </div>
  )
}

function SummaryMetric({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className={cn("sql-lab-result-summary-card", tone)}>
      <small>{label}</small>
      <strong>{value}</strong>
    </div>
  )
}

function HistoryPane({ history, onLoadSql }: { history: SqlHistoryItem[]; onLoadSql: (sql: string) => void }) {
  if (!history.length) return <div className="sql-lab-result-empty"><History size={22} /><strong>暂无运行历史</strong></div>
  return (
    <div className="sql-lab-list-pane">
      {history.map((item) => (
        <button key={item.id} type="button" className="sql-lab-history-row" onClick={() => onLoadSql(item.sql)}>
          <span className={cn("sql-lab-row-status", item.ok ? "is-ok" : "is-error")}>{item.ok ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}</span>
          <span className="min-w-0 flex-1">
            <strong>{shortPreview(item.sql)}</strong>
            <small>{item.ok ? `${item.rowCount} 行 · ${item.durationMs}ms` : item.errorMessage ?? "执行失败"}</small>
          </span>
          <time>{formatChinaDateTime(item.startedAt)}</time>
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
}: {
  saved: SqlSavedQuery[]
  onLoadSql: (sql: string) => void
  onTogglePin: (id: string) => void
  onDeleteSaved: (id: string) => void
}) {
  if (!saved.length) return <div className="sql-lab-result-empty"><Star size={22} /><strong>暂无保存配方</strong></div>
  return (
    <div className="sql-lab-list-pane">
      {saved.map((item) => (
        <div key={item.id} className="sql-lab-saved-row">
          <button type="button" onClick={() => onLoadSql(item.sql)}>
            <span className="sql-lab-row-status is-saved"><Star size={14} /></span>
            <span className="min-w-0 flex-1">
              <strong>{item.name}</strong>
              <small>{item.description || shortPreview(item.sql)}</small>
            </span>
          </button>
          <div className="sql-lab-row-actions">
            <button type="button" onClick={() => onTogglePin(item.id)}>{item.pinned ? <PinOff size={14} /> : <Pin size={14} />}</button>
            <button type="button" onClick={() => onDeleteSaved(item.id)}><Trash2 size={14} /></button>
          </div>
        </div>
      ))}
    </div>
  )
}

function ExamplesPane({ examples, onLoadSql }: { examples: SqlExample[]; onLoadSql: (sql: string) => void }) {
  if (!examples.length) return <div className="sql-lab-result-empty"><Sparkles size={22} /><strong>暂无示例</strong></div>
  return (
    <div className="sql-lab-list-pane">
      {examples.map((item) => (
        <button key={item.id} type="button" className="sql-lab-history-row" onClick={() => onLoadSql(item.sql)}>
          <span className="sql-lab-row-status is-example"><Sparkles size={14} /></span>
          <span className="min-w-0 flex-1">
            <strong>{item.title}</strong>
            <small>{item.description}</small>
          </span>
          <em>{item.category}</em>
        </button>
      ))}
    </div>
  )
}
