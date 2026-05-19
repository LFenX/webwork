"use client"

import { Brain, CheckCircle2, Hand } from "lucide-react"
import { cn } from "@/lib/utils"
import type { SqlStageMode } from "@/lib/sql-lab/types"

type Props = {
  value: SqlStageMode
  onChange: (value: SqlStageMode) => void
  disabled?: boolean
}

const MODES: Array<{ value: SqlStageMode; label: string; icon: typeof CheckCircle2; title: string }> = [
  { value: "auto", label: "Safe Auto", icon: CheckCircle2, title: "SELECT 自动执行，DML/DDL 暂停确认" },
  { value: "analyst", label: "Analyst", icon: Brain, title: "开启自主探查，仍遵循安全栏" },
  { value: "manual", label: "Manual", icon: Hand, title: "所有 SQL 都等待用户手动运行" },
]

export function StageModeSwitch({ value, onChange, disabled }: Props) {
  return (
    <div className="sql-stage-mode-switch" role="tablist" aria-label="Stage 模式">
      {MODES.map((mode) => {
        const Icon = mode.icon
        return (
          <button
            key={mode.value}
            type="button"
            role="tab"
            aria-selected={value === mode.value}
            className={cn(value === mode.value && "is-active")}
            onClick={() => onChange(mode.value)}
            disabled={disabled}
            title={mode.title}
          >
            <Icon size={13} />
            <span>{mode.label}</span>
          </button>
        )
      })}
    </div>
  )
}
