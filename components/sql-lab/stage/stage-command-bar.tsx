"use client"

import { useState, type KeyboardEvent } from "react"
import { ArrowRight, Loader2, Wand2 } from "lucide-react"
import { StageModeSwitch } from "@/components/sql-lab/stage/stage-mode-switch"
import type { SqlStageMode } from "@/lib/sql-lab/types"

type Props = {
  running: boolean
  mode: SqlStageMode
  onModeChange: (mode: SqlStageMode) => void
  onSubmit: (prompt: string) => void
  placeholder?: string
  suggestions?: string[]
}

const DEFAULT_SUGGESTIONS = [
  "最近一周的求职投递转化率",
  "活跃用户画像（按设备和地域）",
  "频道发言密度变化趋势",
  "私聊和频道消息量对比",
]

export function StageCommandBar({ running, mode, onModeChange, onSubmit, placeholder, suggestions }: Props) {
  const [value, setValue] = useState("")

  function handleSubmit(prompt = value) {
    const next = prompt.trim()
    if (!next || running) return
    onSubmit(next)
    setValue("")
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault()
      handleSubmit()
    }
  }

  const hints = suggestions && suggestions.length ? suggestions : DEFAULT_SUGGESTIONS

  return (
    <section className="sql-stage-command">
      <div className="sql-stage-command-head">
        <p>洞察 Stage</p>
        <h2>想分析什么数据？</h2>
        <StageModeSwitch value={mode} onChange={onModeChange} disabled={running} />
      </div>
      <div className="sql-stage-command-input">
        <Wand2 size={18} />
        <textarea
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={onKeyDown}
          rows={1}
          placeholder={placeholder ?? "输入你的问题。例如：最近三天 SQL 实验室的执行成功率和耗时分布"}
        />
        <button type="button" className="sql-stage-submit" onClick={() => handleSubmit()} disabled={!value.trim() || running} aria-label="发起分析">
          {running ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
        </button>
      </div>
      <div className="sql-stage-command-hints">
        <span>试试：</span>
        {hints.map((hint) => (
          <button key={hint} type="button" onClick={() => handleSubmit(hint)} disabled={running}>
            {hint}
          </button>
        ))}
      </div>
    </section>
  )
}
