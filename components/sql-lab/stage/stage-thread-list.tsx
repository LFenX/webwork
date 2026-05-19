"use client"

import { Archive, MessageSquarePlus, Pin, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import type { SqlThreadSummary } from "@/lib/sql-lab/types"

type Props = {
  items: SqlThreadSummary[]
  activeId: string | null
  onSelect: (id: string) => void
  onCreate: () => void
  onTogglePin: (id: string, pinned: boolean) => void
  onArchive: (id: string) => void
  onDelete: (id: string) => void
}

function shortDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  const now = new Date()
  const sameDay = date.toDateString() === now.toDateString()
  if (sameDay) return date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })
  return date.toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" })
}

export function StageThreadList({ items, activeId, onSelect, onCreate, onTogglePin, onArchive, onDelete }: Props) {
  return (
    <div className="sql-stage-thread-list">
      <header>
        <strong>分析线程</strong>
        <button type="button" onClick={onCreate} className="sql-stage-new-thread">
          <MessageSquarePlus size={13} /> 新建
        </button>
      </header>
      <ul>
        {items.length ? items.map((item) => (
          <li key={item.id} className={cn(activeId === item.id && "is-active", item.status === "running" && "is-running", item.status === "error" && "is-error")}>
            <button type="button" onClick={() => onSelect(item.id)} className="sql-stage-thread-item">
              <strong>{item.title}</strong>
              <small>{item.stepCount} 步 · {shortDate(item.lastEventAt)}</small>
            </button>
            <div className="sql-stage-thread-actions">
              <button type="button" onClick={() => onTogglePin(item.id, !item.pinned)} className={item.pinned ? "is-pinned" : ""} title={item.pinned ? "取消置顶" : "置顶"}>
                <Pin size={12} />
              </button>
              <button type="button" onClick={() => onArchive(item.id)} title="归档">
                <Archive size={12} />
              </button>
              <button type="button" onClick={() => onDelete(item.id)} title="删除" className="is-danger">
                <Trash2 size={12} />
              </button>
            </div>
          </li>
        )) : (
          <li className="sql-stage-thread-empty">还没有分析线程，新建一条开始</li>
        )}
      </ul>
    </div>
  )
}
