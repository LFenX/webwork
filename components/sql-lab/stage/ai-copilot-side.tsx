"use client"

import { type CSSProperties } from "react"
import { BrainCircuit, MessageSquare, Network, Terminal } from "lucide-react"
import { cn } from "@/lib/utils"
import type { SqlThreadDetail } from "@/lib/sql-lab/types"

type Props = {
  thread: SqlThreadDetail | null
  streaming: boolean
  onOpenRelations: () => void
  onOpenConsole: () => void
  onAskFollowUp: (prompt: string) => void
}

const FOLLOW_UPS = [
  { label: "解释这次结果", prompt: "请用 3-4 句话总结刚才的分析结果，并指出 2 个值得注意的现象。" },
  { label: "下钻：TOP3", prompt: "在刚才结果的基础上，列出前 3 名并解释他们之间的差异。" },
  { label: "改写为更快版本", prompt: "请优化刚才的 SQL，减少全表扫描或多余 JOIN。" },
]

function lastStepKindLabel(thread: SqlThreadDetail | null) {
  const last = thread?.steps[thread.steps.length - 1]
  if (!last) return "等待问题"
  switch (last.kind) {
    case "user_prompt": return "已接收问题"
    case "tool_call": return "正在检索目录"
    case "candidate_tables": return "已选定数据表"
    case "ai_thinking": return last.status === "running" ? "正在生成 SQL" : "已生成思考流"
    case "sql_draft": return "已交付 SQL 草稿"
    case "sql_run": return last.status === "error" ? "执行失败，可复盘" : "已运行并出结果"
    case "ai_insight": return "已解读结果"
    case "ai_error": return "AI 报告异常"
    default: return "Stage 进行中"
  }
}

function pickConfidence(thread: SqlThreadDetail | null) {
  if (!thread) return null
  for (let i = thread.steps.length - 1; i >= 0; i -= 1) {
    const payload = thread.steps[i]?.payload as { confidence?: number } | null | undefined
    if (typeof payload?.confidence === "number") return Math.round(payload.confidence * 100)
  }
  return null
}

export function AiCopilotSide({ thread, streaming, onOpenRelations, onOpenConsole, onAskFollowUp }: Props) {
  const confidence = pickConfidence(thread)
  const status = lastStepKindLabel(thread)
  const lastSqlStep = [...(thread?.steps ?? [])].reverse().find((step) => step.kind === "sql_draft" && step.sql)

  return (
    <aside className="sql-stage-copilot">
      <header className="sql-stage-copilot-head">
        <span>
          <BrainCircuit size={16} />
        </span>
        <div>
          <h2>AI Copilot</h2>
          <p>聚焦本次分析的研判与下一步建议。</p>
        </div>
      </header>

      <section className="sql-stage-copilot-status">
        <div className={cn("sql-stage-copilot-pulse", streaming && "is-live")}>
          <span />
          <strong>{streaming ? "AI 正在思考" : status}</strong>
        </div>
        {confidence !== null ? (
          <div className="sql-stage-copilot-confidence" style={{ "--confidence": confidence } as CSSProperties}>
            <span>{confidence}%</span>
            <p>当前置信度</p>
          </div>
        ) : null}
      </section>

      {lastSqlStep ? (
        <section className="sql-stage-copilot-sql">
          <strong>最近 SQL 草稿</strong>
          <pre>{lastSqlStep.sql.slice(0, 720)}{lastSqlStep.sql.length > 720 ? "…" : ""}</pre>
          <button type="button" onClick={onOpenConsole}>
            <Terminal size={13} /> 在编辑器里打开
          </button>
        </section>
      ) : null}

      <section className="sql-stage-copilot-next">
        <strong>下一步建议</strong>
        <div className="sql-stage-copilot-actions">
          {FOLLOW_UPS.map((item) => (
            <button key={item.label} type="button" onClick={() => onAskFollowUp(item.prompt)} disabled={streaming}>
              {item.label}
            </button>
          ))}
        </div>
        <div className="sql-stage-copilot-secondary">
          <button type="button" onClick={onOpenRelations}>
            <Network size={13} /> 打开关系图 (R)
          </button>
          <button type="button" onClick={onOpenConsole}>
            <MessageSquare size={13} /> SQL 控制台
          </button>
        </div>
      </section>
    </aside>
  )
}
