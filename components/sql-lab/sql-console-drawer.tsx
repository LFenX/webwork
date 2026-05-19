"use client"

import type { CSSProperties, ReactNode } from "react"
import {
  ChevronDown,
  ChevronUp,
  Database,
  FileCode2,
  Loader2,
  Pause,
  Play,
  Plus,
  Save,
  Settings2,
  Wand2,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { ResizeHandle } from "@/components/sql-lab/resize-handle"
import { cn } from "@/lib/utils"

export type SqlConsoleTab = {
  id: string
  title: string
  sql: string
}

export type SqlConsolePane = "editor"

type Props = {
  open: boolean
  tabs: SqlConsoleTab[]
  activeTabId: string
  currentSql: string
  running: boolean
  limit: number
  maxLimit: number
  durationMs?: number
  rowCount?: number
  consoleHeight?: number
  onOpenChange: (open: boolean) => void
  onConsoleHeightChange?: (height: number) => void
  onActiveTabChange: (id: string) => void
  onNewTab: () => void
  onCloseTab: (id: string) => void
  onRun: () => void
  onFormat: () => void
  onSave: () => void
  onLimitChange: (limit: number) => void
  editor: ReactNode
}

export function SqlConsoleDrawer({
  open,
  tabs,
  activeTabId,
  currentSql,
  running,
  limit,
  maxLimit,
  durationMs,
  rowCount,
  consoleHeight = 380,
  onOpenChange,
  onConsoleHeightChange,
  onActiveTabChange,
  onNewTab,
  onCloseTab,
  onRun,
  onFormat,
  onSave,
  onLimitChange,
  editor,
}: Props) {
  const handleCopy = open
    ? "编辑、校验、格式化和运行 SQL"
    : currentSql.trim()
      ? "已有 SQL 草稿，可展开调整"
      : "传统编辑器已收起，需要时再打开"

  const consoleStyle = { "--sql-console-body-height": `${consoleHeight}px` } as CSSProperties

  return (
    <section className={cn("sql-lab-console-drawer", open && "is-open")} style={consoleStyle}>
      <button type="button" className="sql-lab-console-handle" onClick={() => onOpenChange(!open)}>
        <span className="sql-lab-console-icon"><FileCode2 size={18} /></span>
        <span className="min-w-0 flex-1">
          <strong>SQL 控制台</strong>
          <small>{handleCopy}</small>
        </span>
        <span className="sql-lab-console-state">
          {currentSql.trim() ? "草稿" : "待命"}
          {open ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
        </span>
      </button>

      {open ? (
        <>
          <ResizeHandle
            axis="y"
            ariaLabel="调整 SQL 控制台高度"
            className="sql-lab-console-resize-handle"
            getValue={() => -consoleHeight}
            onChange={(next) => onConsoleHeightChange?.(Math.max(280, Math.min(760, -next)))}
            onReset={() => onConsoleHeightChange?.(380)}
          />
          <div className="sql-lab-console-body">
          <div className="sql-lab-console-panel">
            <div className="sql-lab-console-tabs">
              {tabs.map((tab) => {
                const active = tab.id === activeTabId
                return (
                  <div
                    key={tab.id}
                    className={cn("sql-lab-console-tab", active && "is-active")}
                  >
                    <button type="button" onClick={() => onActiveTabChange(tab.id)}>
                      <Database size={13} />
                      <span>{tab.title}</span>
                    </button>
                    <button
                      type="button"
                      aria-label="关闭查询"
                      onClick={() => onCloseTab(tab.id)}
                    >
                      <X size={12} />
                    </button>
                  </div>
                )
              })}
              <button type="button" className="sql-lab-console-new-tab" onClick={onNewTab}>
                <Plus size={13} /> 新查询
              </button>
            </div>

            <div className="sql-lab-console-toolbar">
              <Button size="sm" onClick={onRun} disabled={running || !currentSql.trim()} className="h-8 gap-1 rounded-full px-3 text-xs">
                {running ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
                运行
              </Button>
              {running ? (
                <Button size="sm" variant="outline" disabled className="h-8 gap-1 rounded-full px-3 text-xs">
                  <Pause size={13} /> 等待响应
                </Button>
              ) : null}
              <Button size="sm" variant="outline" onClick={onFormat} disabled={!currentSql.trim()} className="h-8 gap-1 rounded-full px-3 text-xs">
                <Wand2 size={13} /> 格式化
              </Button>
              <Button size="sm" variant="outline" onClick={onSave} disabled={!currentSql.trim()} className="h-8 gap-1 rounded-full px-3 text-xs">
                <Save size={13} /> 保存配方
              </Button>

              <label className="sql-lab-limit-control">
                <Settings2 size={13} />
                <span>limit</span>
                <input
                  type="number"
                  min={1}
                  max={maxLimit}
                  value={limit}
                  onChange={(event) => onLimitChange(Math.max(1, Number(event.target.value) || 1))}
                />
              </label>

              <div className="sql-lab-console-stats">
                <span>{typeof durationMs === "number" ? `${durationMs}ms` : "idle"}</span>
                {typeof rowCount === "number" ? <span>{rowCount} rows</span> : null}
              </div>
            </div>

            <div className="sql-lab-console-editor">
              {editor}
            </div>
          </div>
          </div>
        </>
      ) : null}
    </section>
  )
}
