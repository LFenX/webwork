"use client"

import { ReactNode, useEffect, useMemo, useRef, useState } from "react"
import { GripVertical, LayoutGrid, Minus, Plus, RotateCcw, Save, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { confirmAction } from "@/lib/interaction-feedback"
import { DEFAULT_HOME_LAYOUT, HOME_WIDGET_LABELS, type HomeWidgetId, type HomeWidgetLayout } from "@/lib/home-layout"

type Widget = { id: HomeWidgetId; content: ReactNode }

function widgetSpanClass(width: number) {
  const span = Math.min(12, Math.max(1, Math.round(width)))
  const map: Record<number, string> = {
    1: "md:col-span-1",
    2: "md:col-span-2",
    3: "md:col-span-3",
    4: "md:col-span-4",
    5: "md:col-span-5",
    6: "md:col-span-6",
    7: "md:col-span-7",
    8: "md:col-span-8",
    9: "md:col-span-9",
    10: "md:col-span-10",
    11: "md:col-span-11",
    12: "md:col-span-12",
  }
  return map[span] ?? "md:col-span-12"
}

export function HomeLayoutBoard({
  widgets,
  initialLayout,
  editable = false,
  initialEditing = false,
  showEditTrigger = true,
  toolbar,
  editing: externalEditing,
  onEditingChange,
}: {
  widgets: Widget[]
  initialLayout: HomeWidgetLayout[]
  editable?: boolean
  initialEditing?: boolean
  showEditTrigger?: boolean
  toolbar?: ReactNode
  editing?: boolean
  onEditingChange?: (v: boolean) => void
}) {
  const [internalEditing, setInternalEditing] = useState(initialEditing)
  const editing = externalEditing !== undefined ? externalEditing : internalEditing
  const setEditing = onEditingChange || setInternalEditing
  const [layout, setLayout] = useState(initialLayout)
  const [dragging, setDragging] = useState<HomeWidgetId | null>(null)
  const [saving, setSaving] = useState(false)
  const [resetting, setResetting] = useState(false)
  const longPressTimerRef = useRef<number | null>(null)
  const widgetMap = useMemo(() => new Map(widgets.map((widget) => [widget.id, widget.content])), [widgets])
  const visible = layout.filter((item) => widgetMap.has(item.id) && (!item.hidden || editing)).sort((a, b) => a.y - b.y)
  const hidden = layout.filter((item) => item.hidden)

  useEffect(() => {
    return () => {
      if (longPressTimerRef.current !== null) {
        window.clearTimeout(longPressTimerRef.current)
      }
    }
  }, [])

  function update(id: HomeWidgetId, patch: Partial<HomeWidgetLayout>) {
    setLayout((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)))
  }

  function moveBefore(target: HomeWidgetId) {
    if (!dragging || dragging === target) return
    setLayout((current) => {
      const ordered = [...current].sort((a, b) => a.y - b.y)
      const dragged = ordered.find((item) => item.id === dragging)
      if (!dragged) return current
      const rest = ordered.filter((item) => item.id !== dragging)
      const index = rest.findIndex((item) => item.id === target)
      rest.splice(index < 0 ? rest.length : index, 0, dragged)
      return rest.map((item, y) => ({ ...item, y }))
    })
  }

  function clearLongPressTimer() {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }

  async function save() {
    setSaving(true)
    try {
      const res = await fetch("/api/home-layout", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: layout }),
      })
      if (!res.ok) {
        toast.error("布局保存失败")
        return
      }
      toast.success("布局已保存")
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  async function reset() {
    if (!confirmAction("恢复默认首页布局？当前自定义排序和隐藏状态会被清空。")) return
    setResetting(true)
    try {
      const res = await fetch("/api/home-layout", { method: "DELETE" })
      if (res.ok) {
        setLayout(DEFAULT_HOME_LAYOUT)
        toast.success("已恢复默认布局")
      } else {
        toast.error("恢复默认布局失败")
      }
    } finally {
      setResetting(false)
    }
  }

  return (
    <div>
      {(!onEditingChange && (toolbar || (editable && (showEditTrigger || editing)))) && (
        <div className="mb-2 flex items-center justify-end gap-2">
          {editable && (
            <>
              {showEditTrigger && (
              <Button type="button" size="icon" variant="outline" title="调整首页布局" onClick={() => setEditing(!editing)}>
                  <LayoutGrid size={15} />
                </Button>
              )}
              {editing && (
                <>
                  <Button type="button" size="sm" variant="outline" onClick={reset} loading={resetting} loadingText="恢复中..."><RotateCcw size={14} /> 恢复默认</Button>
                  <Button type="button" size="sm" onClick={save} loading={saving} loadingText="保存中..."><Save size={14} /> 保存布局</Button>
                </>
              )}
            </>
          )}
          {toolbar}
        </div>
      )}
      {editing && hidden.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface] p-3">
          <span className="text-xs text-[--color-text-muted]">添加部件</span>
          {hidden.map((item) => (
            <Button key={item.id} type="button" size="sm" variant="outline" onClick={() => update(item.id, { hidden: false })}>
              <Plus size={13} /> {HOME_WIDGET_LABELS[item.id]}
            </Button>
          ))}
        </div>
      )}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-12">
        {visible.map((item) => (
          <div
            key={item.id}
            draggable={editing}
            onDragStart={() => setDragging(item.id)}
            onDragEnd={() => setDragging(null)}
            onDragOver={(event) => {
              if (editing) event.preventDefault()
            }}
            onDrop={() => moveBefore(item.id)}
            onPointerDown={(event) => {
              if (!editing || event.pointerType !== "touch") return
              clearLongPressTimer()
              longPressTimerRef.current = window.setTimeout(() => {
                setDragging(item.id)
                toast.success("Long press activated. Move over another card to reorder.")
              }, 320)
            }}
            onPointerEnter={() => {
              if (editing && dragging) moveBefore(item.id)
            }}
            onPointerUp={() => {
              clearLongPressTimer()
              if (dragging === item.id) {
                setDragging(null)
              }
            }}
            onPointerCancel={clearLongPressTimer}
            className={editing
              ? `relative min-w-0 rounded-[--radius-lg] outline outline-1 outline-dashed ${widgetSpanClass(item.w)} ${dragging === item.id ? "outline-[--color-link] bg-[--color-bg-hover]" : "outline-[--color-accent]"}`
              : `min-w-0 ${widgetSpanClass(item.w)}`}
            style={{ minHeight: editing ? `${Math.max(1, item.h) * 72}px` : undefined }}
          >
            {editing && (
              <div className="absolute right-2 top-2 z-20 flex items-center gap-1 rounded border border-[--color-border] bg-[--color-bg-primary] p-1 shadow-md">
                <GripVertical size={14} className="cursor-grab text-[--color-text-muted]" />
                <button type="button" title="缩小宽度" onClick={() => update(item.id, { w: Math.max(3, item.w - 3) })}><Minus size={13} /></button>
                <button type="button" title="增加宽度" onClick={() => update(item.id, { w: Math.min(12, item.w + 3) })}><Plus size={13} /></button>
                <button type="button" title="降低高度" onClick={() => update(item.id, { h: Math.max(1, item.h - 1) })}><Minus size={13} /></button>
                <button type="button" title="增加高度" onClick={() => update(item.id, { h: Math.min(8, item.h + 1) })}><Plus size={13} /></button>
                <button type="button" title="删除部件" onClick={() => update(item.id, { hidden: true })}><X size={13} /></button>
              </div>
            )}
            <div className={editing ? "h-full p-2" : ""}>{widgetMap.get(item.id)}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
