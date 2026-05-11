"use client"

import { useState } from "react"
import type { PublicationForm } from "@/lib/resume/form-types"
import { emptyPublication } from "@/lib/resume/form-types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Plus, Trash2, ChevronDown, ChevronRight } from "lucide-react"

export function PublicationsSection({
  values,
  onChange,
  title,
}: {
  values: PublicationForm[]
  onChange: (v: PublicationForm[]) => void
  title?: string
}) {
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set())

  function update(i: number, field: keyof PublicationForm, val: string) {
    const next = [...values]
    next[i] = { ...next[i], [field]: val }
    onChange(next)
  }

  function remove(i: number) {
    onChange(values.filter((_, idx) => idx !== i))
    setCollapsed((prev) => { const s = new Set(prev); s.delete(i); return s })
  }

  function toggle(i: number) {
    setCollapsed((prev) => { const s = new Set(prev); if (s.has(i)) s.delete(i); else s.add(i); return s })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-[--color-text-secondary]">{title ?? "出版物"}</span>
        <Button type="button" variant="outline" size="sm" onClick={() => onChange([...values, emptyPublication()])} className="h-7 gap-1 text-xs">
          <Plus size={12} /> 添加
        </Button>
      </div>

      {values.length === 0 && (
        <p className="text-xs text-[--color-text-muted]">暂无出版物，点击&quot;添加&quot;新增。</p>
      )}

      <div className="space-y-2">
        {values.map((pub, i) => {
          const isCollapsed = collapsed.has(i)
          return (
            <div key={i} className="rounded-lg border border-[--color-border] bg-[--color-bg-hover]">
              <div className="flex items-center gap-2 px-3 py-2">
                <button type="button" onClick={() => toggle(i)} className="p-0.5 text-[--color-text-muted]">
                  {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                </button>
                <span className="flex-1 truncate text-sm font-medium">
                  {pub.name || `出版物 #${i + 1}`}
                </span>
                <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0 text-[--color-text-muted] hover:text-[--color-danger]" onClick={() => remove(i)}>
                  <Trash2 size={13} />
                </Button>
              </div>
              {!isCollapsed && (
                <div className="border-t border-[--color-border] p-3 space-y-3">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <Label className="text-xs text-[--color-text-secondary]">名称</Label>
                      <Input value={pub.name} onChange={(e) => update(i, "name", e.target.value)} placeholder="出版物名称" className="mt-1 h-8 text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs text-[--color-text-secondary]">出版商</Label>
                      <Input value={pub.publisher} onChange={(e) => update(i, "publisher", e.target.value)} placeholder="出版商" className="mt-1 h-8 text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs text-[--color-text-secondary]">发布日期</Label>
                      <Input value={pub.releaseDate} onChange={(e) => update(i, "releaseDate", e.target.value)} type="month" className="mt-1 h-8 text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs text-[--color-text-secondary]">链接</Label>
                      <Input value={pub.url} onChange={(e) => update(i, "url", e.target.value)} placeholder="https://..." className="mt-1 h-8 text-sm" />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-[--color-text-secondary]">摘要</Label>
                    <Textarea value={pub.summary} onChange={(e) => update(i, "summary", e.target.value)} placeholder="出版物摘要" className="mt-1 h-16 text-sm" />
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
