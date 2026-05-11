"use client"

import type { WorkForm } from "@/lib/resume/form-types"
import { emptyWork } from "@/lib/resume/form-types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ArrayField } from "./array-field"
import { Plus, Trash2, ChevronDown, ChevronRight } from "lucide-react"
import { useState } from "react"

export function WorkSection({
  values,
  onChange,
  title,
}: {
  values: WorkForm[]
  onChange: (v: WorkForm[]) => void
  title?: string
}) {
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set())

  function update(i: number, field: keyof WorkForm, val: unknown) {
    const next = [...values]
    next[i] = { ...next[i], [field]: val }
    onChange(next)
  }

  function remove(i: number) {
    onChange(values.filter((_, idx) => idx !== i))
    setCollapsed((prev) => { const s = new Set(prev); s.delete(i); return s })
  }

  function add() {
    onChange([...values, emptyWork()])
  }

  function toggle(i: number) {
    setCollapsed((prev) => { const s = new Set(prev); if (s.has(i)) s.delete(i); else s.add(i); return s })
  }

  return (
    <section className="rounded-xl border border-[--color-border] bg-[--color-bg-surface] p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold">{title ?? "工作经历"}</h2>
        <Button type="button" variant="outline" size="sm" onClick={add} className="gap-1">
          <Plus size={13} /> 添加
        </Button>
      </div>
      {values.length === 0 && (
        <p className="text-xs text-[--color-text-muted]">暂无工作经历，点击&quot;添加&quot;新增。</p>
      )}
      <div className="space-y-3">
        {values.map((w, i) => {
          const isCollapsed = collapsed.has(i)
          return (
            <div key={i} className="rounded-lg border border-[--color-border] bg-[--color-bg-hover]">
              <div className="flex items-center gap-2 px-3 py-2">
                <button type="button" onClick={() => toggle(i)} className="p-0.5 text-[--color-text-muted]">
                  {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                </button>
                <span className="flex-1 text-sm font-medium truncate">
                  {w.position || w.name ? `${w.position}${w.position && w.name ? " @ " : ""}${w.name}` : `工作经历 #${i + 1}`}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-[--color-text-muted] hover:text-[--color-danger]"
                  onClick={() => remove(i)}
                  title="删除"
                >
                  <Trash2 size={13} />
                </Button>
              </div>
              {!isCollapsed && (
                <div className="border-t border-[--color-border] p-3 space-y-3">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <Label className="text-xs text-[--color-text-secondary]">公司名称</Label>
                      <Input value={w.name} onChange={(e) => update(i, "name", e.target.value)} placeholder="公司" className="mt-1 h-8 text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs text-[--color-text-secondary]">职位</Label>
                      <Input value={w.position} onChange={(e) => update(i, "position", e.target.value)} placeholder="职位" className="mt-1 h-8 text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs text-[--color-text-secondary]">公司链接</Label>
                      <Input value={w.url} onChange={(e) => update(i, "url", e.target.value)} placeholder="https://..." className="mt-1 h-8 text-sm" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs text-[--color-text-secondary]">开始时间</Label>
                        <Input value={w.startDate} onChange={(e) => update(i, "startDate", e.target.value)} type="month" className="mt-1 h-8 text-sm" />
                      </div>
                      <div>
                        <Label className="text-xs text-[--color-text-secondary]">结束时间</Label>
                        <Input value={w.endDate} onChange={(e) => update(i, "endDate", e.target.value)} type="month" disabled={w.current} className="mt-1 h-8 text-sm" />
                      </div>
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-[--color-text-secondary]">
                    <input type="checkbox" checked={w.current} onChange={(e) => update(i, "current", e.target.checked)} className="size-3.5" />
                    至今
                  </label>
                  <div>
                    <Label className="text-xs text-[--color-text-secondary]">简介</Label>
                    <Textarea value={w.summary} onChange={(e) => update(i, "summary", e.target.value)} placeholder="工作内容概述" className="mt-1 h-20 text-sm" />
                  </div>
                  <ArrayField
                    label="亮点"
                    values={w.highlights}
                    onChange={(v) => update(i, "highlights", v)}
                    placeholder="一项成就或亮点"
                  />
                  <details className="rounded-md border border-[--color-border]">
                    <summary className="cursor-pointer select-none px-3 py-1.5 text-xs text-[--color-text-muted]">
                      更多字段（公司描述、工作地点）
                    </summary>
                    <div className="border-t border-[--color-border] p-3 space-y-3">
                      <div>
                        <label className="text-xs text-[--color-text-secondary]">公司描述</label>
                        <input value={w.description} onChange={(e) => update(i, "description", e.target.value)} placeholder="简短描述公司业务" className="mt-1 h-8 w-full rounded-[10px] border border-input bg-background px-3 text-sm" />
                      </div>
                      <div>
                        <label className="text-xs text-[--color-text-secondary]">工作地点</label>
                        <input value={w.location} onChange={(e) => update(i, "location", e.target.value)} placeholder="如：北京" className="mt-1 h-8 w-full rounded-[10px] border border-input bg-background px-3 text-sm" />
                      </div>
                    </div>
                  </details>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
