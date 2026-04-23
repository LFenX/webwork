"use client"

import { ReactNode, useMemo, useState } from "react"
import { GripVertical, LayoutGrid, Minus, Plus, RotateCcw, Save, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { DEFAULT_HOME_LAYOUT, HOME_WIDGET_LABELS, type HomeWidgetId, type HomeWidgetLayout } from "@/lib/home-layout"

type Widget = { id: HomeWidgetId; content: ReactNode }

export function HomeLayoutBoard({
  widgets,
  initialLayout,
  editable = false,
  toolbar,
}: {
  widgets: Widget[]
  initialLayout: HomeWidgetLayout[]
  editable?: boolean
  toolbar?: ReactNode
}) {
  const [editing, setEditing] = useState(false)
  const [layout, setLayout] = useState(initialLayout)
  const [dragging, setDragging] = useState<HomeWidgetId | null>(null)
  const widgetMap = useMemo(() => new Map(widgets.map((widget) => [widget.id, widget.content])), [widgets])
  const visible = layout.filter((item) => widgetMap.has(item.id) && (!item.hidden || editing)).sort((a, b) => a.y - b.y)
  const hidden = layout.filter((item) => item.hidden)

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

  async function save() {
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
  }

  async function reset() {
    const res = await fetch("/api/home-layout", { method: "DELETE" })
    if (res.ok) {
      setLayout(DEFAULT_HOME_LAYOUT)
      toast.success("已恢复默认布局")
    }
  }

  return (
    <div>
      {(editable || toolbar) && (
        <div className="mb-8 flex items-center justify-end gap-2">
          {editable && (
            <>
              <Button type="button" size="icon" variant="outline" title="调整首页布局" onClick={() => setEditing((value) => !value)}>
                <LayoutGrid size={15} />
              </Button>
              {editing && (
                <>
                  <Button type="button" size="sm" variant="outline" onClick={reset}><RotateCcw size={14} /> 恢复默认</Button>
                  <Button type="button" size="sm" onClick={save}><Save size={14} /> 保存布局</Button>
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
      <div className="grid grid-cols-1 gap-8 md:grid-cols-12">
        {visible.map((item) => (
          <div
            key={item.id}
            draggable={editing}
            onDragStart={() => setDragging(item.id)}
            onDragOver={(event) => {
              if (editing) event.preventDefault()
            }}
            onDrop={() => moveBefore(item.id)}
            className={editing ? "relative rounded-[--radius-lg] outline outline-1 outline-dashed outline-[--color-accent]" : ""}
            style={{ gridColumn: `span ${Math.min(12, Math.max(1, item.w))} / span ${Math.min(12, Math.max(1, item.w))}`, minHeight: editing ? `${Math.max(1, item.h) * 72}px` : undefined }}
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
