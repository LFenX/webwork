"use client"

import { useState, type ReactNode } from "react"
import {
  AlertTriangle,
  Brain,
  CheckCircle2,
  Code2,
  Database,
  FileSearch,
  Lightbulb,
  Loader2,
  PenLine,
  Play,
  SearchCheck,
  Sparkles,
  Wrench,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { MarkdownContent } from "@/components/markdown-content"
import { ChartPanel } from "@/components/sql-lab/visualization/chart-panel"
import type { SqlThreadCandidateTable, SqlThreadStep } from "@/lib/sql-lab/types"

type Props = {
  step: SqlThreadStep
  isLast?: boolean
  onApplySql?: (sql: string, title?: string) => void
  onRunSql?: (sql: string, title?: string, stepId?: string) => void
  onRepairSql?: (input: SqlRunRepairInput) => void
  onInsertTable?: (qualifiedName: string) => void
  onRewindBefore?: (stepId: string) => void
}

export type SqlRunRepairInput = {
  sql: string
  title?: string
  stepId?: string
  bodyMarkdown?: string
  errorCode?: string
  errorMessage: string
  errorHint?: string
}

type RoleBadgeClass = "is-primary" | "is-join" | "is-reference"

function roleClass(role: SqlThreadCandidateTable["role"]): RoleBadgeClass {
  if (role === "join") return "is-join"
  if (role === "reference") return "is-reference"
  return "is-primary"
}

function shortTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
}

export function StepCard({ step, isLast, onApplySql, onRunSql, onRepairSql, onInsertTable, onRewindBefore }: Props) {
  const [chartOpen, setChartOpen] = useState(false)
  return (
    <article className={cn("sql-stage-step", `is-${step.kind}`, `is-status-${step.status}`, isLast && "is-last")}>
      <div className="sql-stage-step-rail">
        <StepIcon step={step} />
      </div>
      <div className="sql-stage-step-body">
        <header className="sql-stage-step-head">
          <strong>{step.title || prettyKind(step.kind)}</strong>
          <span>{shortTime(step.createdAt)}</span>
          {step.durationMs ? <em>{(step.durationMs / 1000).toFixed(2)}s</em> : null}
        </header>
        {renderStepBody(step, { onApplySql, onRunSql, onRepairSql, onInsertTable, onRewindBefore, chartOpen, setChartOpen })}
      </div>
    </article>
  )
}

function StepIcon({ step }: { step: SqlThreadStep }) {
  if (step.status === "running") return <Loader2 size={15} className="animate-spin" />
  if (step.status === "error") return <AlertTriangle size={15} />
  switch (step.kind) {
    case "user_prompt":
      return <PenLine size={14} />
    case "tool_call":
      return <Wrench size={14} />
    case "candidate_tables":
      return <Database size={14} />
    case "ai_probe_sql":
      return <SearchCheck size={14} />
    case "ai_thinking":
      return <Brain size={14} />
    case "sql_draft":
      return <Code2 size={14} />
    case "sql_run":
      return <Play size={14} />
    case "ai_insight":
      return <Lightbulb size={14} />
    case "user_note":
      return <FileSearch size={14} />
    case "ai_error":
      return <AlertTriangle size={14} />
    default:
      return <Sparkles size={14} />
  }
}

function prettyKind(kind: SqlThreadStep["kind"]) {
  switch (kind) {
    case "user_prompt": return "你的问题"
    case "tool_call": return "工具调用"
    case "candidate_tables": return "AI 推荐数据表"
    case "ai_probe_sql": return "AI 自主探查"
    case "ai_thinking": return "AI 思考流"
    case "sql_draft": return "SQL 草稿"
    case "sql_run": return "执行结果"
    case "ai_insight": return "AI 解读"
    case "ai_error": return "执行失败"
    case "user_note": return "你的笔记"
    default: return "Stage 步骤"
  }
}

function renderStepBody(step: SqlThreadStep, handlers: {
  onApplySql?: Props["onApplySql"]
  onRunSql?: Props["onRunSql"]
  onRepairSql?: Props["onRepairSql"]
  onInsertTable?: Props["onInsertTable"]
  onRewindBefore?: Props["onRewindBefore"]
  chartOpen?: boolean
  setChartOpen?: (open: boolean) => void
}): ReactNode {
  const payload = (step.payload ?? {}) as Record<string, unknown>

  if (step.kind === "user_prompt" || step.kind === "user_note") {
    return <p className="sql-stage-step-prompt">{step.bodyMarkdown}</p>
  }

  if (step.kind === "tool_call") {
    const tool = String(payload.tool ?? "")
    const matches = Array.isArray(payload.matches) ? (payload.matches as Array<{ schema: string; table: string; reasons?: string[] }>) : []
    return (
      <div className="sql-stage-tool-call">
        <div className="sql-stage-tool-meta">
          <span className="sql-stage-chip">{tool || "tool"}</span>
          <p>{step.bodyMarkdown}</p>
        </div>
        {matches.length ? (
          <div className="sql-stage-tool-matches">
            {matches.slice(0, 6).map((match) => (
              <span key={`${match.schema}.${match.table}`}>
                <code>{match.schema}.{match.table}</code>
                {match.reasons?.[0] ? <small>{match.reasons[0]}</small> : null}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    )
  }

  if (step.kind === "candidate_tables") {
    const tables = Array.isArray(payload.tables) ? (payload.tables as SqlThreadCandidateTable[]) : []
    const confidence = typeof payload.confidence === "number" ? Math.round(payload.confidence * 100) : null
    return (
      <div className="sql-stage-candidates">
        {step.bodyMarkdown ? <MarkdownContent source={step.bodyMarkdown} /> : null}
        <div className="sql-stage-candidate-list">
          {tables.length ? tables.map((table) => {
            const qualified = `${table.schema}.${table.table}`
            return (
              <button
                key={qualified}
                type="button"
                className={cn("sql-stage-candidate", roleClass(table.role))}
                onClick={() => handlers.onInsertTable?.(qualified)}
                title="双击将表注入到 SQL 编辑器"
                onDoubleClick={() => handlers.onInsertTable?.(qualified)}
              >
                <span>{table.role === "primary" ? "主表" : table.role === "join" ? "关联" : "参考"}</span>
                <strong>{table.table}</strong>
                <small>{table.reason}</small>
              </button>
            )
          }) : <p className="sql-stage-muted">还未从目录里挑出候选表。</p>}
        </div>
        {confidence !== null ? <div className="sql-stage-confidence-line">Selector 置信度 {confidence}%</div> : null}
      </div>
    )
  }

  if (step.kind === "ai_thinking") {
    const reasoning = typeof payload.reasoning === "string" ? payload.reasoning : ""
    const assistant = typeof payload.assistant === "string" ? payload.assistant : ""
    const showLive = step.status === "running"
    return (
      <div className={cn("sql-stage-thinking", showLive && "is-live")}>
        {reasoning ? (
          <details className="sql-stage-reasoning" open={showLive}>
            <summary>原始思考流（模型输出）</summary>
            <pre>{reasoning}</pre>
          </details>
        ) : null}
        {assistant ? (
          <div className="sql-stage-assistant-stream">
            <pre>{assistant}</pre>
          </div>
        ) : null}
        {step.bodyMarkdown && !assistant ? <MarkdownContent source={step.bodyMarkdown} /> : null}
        {showLive ? <span className="sql-stage-typing-indicator">正在思考…</span> : null}
      </div>
    )
  }

  if (step.kind === "sql_draft") {
    const confidence = typeof payload.confidence === "number" ? Math.round(payload.confidence * 100) : null
    const reasoningMarkdown = typeof payload.reasoningMarkdown === "string" ? payload.reasoningMarkdown : ""
    const selfValidated = Boolean(payload.selfValidated)
    const safety = payload.safety && typeof payload.safety === "object" ? payload.safety as { action?: string; reason?: string } : null
    return (
      <div className="sql-stage-sql-draft">
        {step.bodyMarkdown ? <p className="sql-stage-step-prompt">{step.bodyMarkdown}</p> : null}
        <pre className="sql-stage-code">
          <code>{step.sql}</code>
        </pre>
        <div className="sql-stage-action-row">
          <button type="button" className="is-primary" onClick={() => handlers.onRunSql?.(step.sql, payload.title as string, step.id)}>
            ▶ 直接运行
          </button>
          <button type="button" onClick={() => handlers.onApplySql?.(step.sql, payload.title as string)}>
            送入编辑器
          </button>
          {confidence !== null ? <span className="sql-stage-meta-tag">置信度 {confidence}%</span> : null}
          {selfValidated ? <span className="sql-stage-meta-tag is-ok">✓ 自检通过</span> : null}
          {safety?.action ? <span className="sql-stage-meta-tag">{safety.action === "auto_execute" ? "Safe Auto" : safety.action === "manual_approve" ? "需确认" : "已拒绝"}</span> : null}
        </div>
        {reasoningMarkdown ? (
          <details className="sql-stage-reasoning">
            <summary>查看完整推理</summary>
            <MarkdownContent source={reasoningMarkdown} />
          </details>
        ) : null}
      </div>
    )
  }

  if (step.kind === "ai_probe_sql") {
    const rowCount = typeof payload.rowCount === "number" ? payload.rowCount : 0
    const sampleRows = Array.isArray(payload.sampleRows) ? (payload.sampleRows as Array<Record<string, unknown>>) : []
    const columns = Array.isArray(payload.columns)
      ? (payload.columns as Array<{ name: string; type?: string }>)
      : []
    const error = payload.error as { code?: string; message?: string; hint?: string } | undefined
    return (
      <details className="sql-stage-probe-card" open={step.status !== "done"}>
        <summary>
          <span>{String(payload.purpose ?? step.bodyMarkdown ?? "AI 自主探查")}</span>
          <em>{step.status === "error" ? "失败" : `${rowCount} 行`}</em>
        </summary>
        <pre className="sql-stage-code">
          <code>{step.sql}</code>
        </pre>
        {sampleRows.length ? (
          <div className="sql-stage-run-table is-probe">
            <table>
              <thead>
                <tr>{columns.map((column) => <th key={column.name}>{column.name}</th>)}</tr>
              </thead>
              <tbody>
                {sampleRows.slice(0, 8).map((row, index) => (
                  <tr key={index}>
                    {columns.map((column) => <td key={column.name}>{formatCell(row[column.name])}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {error?.message ? (
          <div className="sql-stage-error-block">
            <strong>{error.message}</strong>
            {error.hint ? <p>{error.hint}</p> : null}
          </div>
        ) : null}
      </details>
    )
  }

  if (step.kind === "sql_run") {
    const rowCount = typeof payload.rowCount === "number" ? payload.rowCount : 0
    const truncated = Boolean(payload.truncated)
    const sampleRows = Array.isArray(payload.sampleRows) ? (payload.sampleRows as Array<Record<string, unknown>>) : []
    const columns = Array.isArray(payload.columns)
      ? (payload.columns as Array<{ name: string; type?: string }>)
      : []
    const error = payload.error as { code?: string; message?: string; hint?: string } | undefined
    const okStatus = step.status !== "error"
    return (
      <div className="sql-stage-run-result">
        <div className="sql-stage-run-summary">
          <span className={cn("sql-stage-run-pill", okStatus ? "is-ok" : "is-err")}>{okStatus ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />} {okStatus ? "执行成功" : "执行失败"}</span>
          <span>{rowCount} 行</span>
          {truncated ? <span>已截断</span> : null}
          <span>{step.durationMs} ms</span>
          {okStatus && sampleRows.length ? (
            <button type="button" className="sql-stage-inline-action" onClick={() => handlers.setChartOpen?.(!handlers.chartOpen)}>
              📊 可视化
            </button>
          ) : null}
          {!okStatus && step.sql && error?.message ? (
            <button
              type="button"
              className="sql-stage-inline-action is-repair"
              onClick={() => handlers.onRepairSql?.({
                sql: step.sql,
                title: step.title,
                stepId: step.id,
                bodyMarkdown: step.bodyMarkdown,
                errorCode: error.code,
                errorMessage: error.message ?? step.errorMessage ?? "SQL execution failed",
                errorHint: error.hint,
              })}
            >
              <Wrench size={13} /> 按错误修复
            </button>
          ) : null}
          <button type="button" className="sql-stage-inline-action" onClick={() => handlers.onRewindBefore?.(step.id)}>
            撤回到此步前
          </button>
        </div>
        {okStatus && sampleRows.length ? (
          <div className="sql-stage-run-table">
            <table>
              <thead>
                <tr>{columns.map((column) => <th key={column.name}>{column.name}</th>)}</tr>
              </thead>
              <tbody>
                {sampleRows.map((row, index) => (
                  <tr key={index}>
                    {columns.map((column) => <td key={column.name}>{formatCell(row[column.name])}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {okStatus && !sampleRows.length ? <p className="sql-stage-muted">执行完成，但本次没有返回行。</p> : null}
        {!okStatus && error?.message ? (
          <div className="sql-stage-error-block">
            <strong>{error.message}</strong>
            {error.hint ? <p>{error.hint}</p> : null}
          </div>
        ) : null}
        {okStatus && handlers.chartOpen ? (
          <ChartPanel columns={columns.map((column) => ({ name: column.name, type: column.type ?? "unknown" }))} rows={sampleRows} sql={step.sql} threadId={step.threadId} title={step.title} variant="single" />
        ) : null}
      </div>
    )
  }

  if (step.kind === "ai_insight" || step.kind === "ai_error") {
    return (
      <div className="sql-stage-insight">
        <MarkdownContent source={step.bodyMarkdown} />
      </div>
    )
  }

  return <p className="sql-stage-step-prompt">{step.bodyMarkdown}</p>
}

function formatCell(value: unknown) {
  if (value === null || value === undefined) return "—"
  if (typeof value === "object") return JSON.stringify(value)
  return String(value)
}
