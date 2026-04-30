"use client"

import { useState } from "react"
import type { VolunteerForm } from "@/lib/resume/form-types"
import { emptyVolunteer } from "@/lib/resume/form-types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ArrayField } from "./array-field"
import { Plus, Trash2, ChevronDown, ChevronRight } from "lucide-react"

export function VolunteerSection({
  values,
  onChange,
  title,
}: {
  values: VolunteerForm[]
  onChange: (v: VolunteerForm[]) => void
  title?: string
}) {
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set())

  function update(i: number, field: keyof VolunteerForm, val: unknown) {
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
        <span className="text-xs font-semibold text-[--color-text-secondary]">{title ?? "志愿经历"}</span>
        <Button type="button" variant="outline" size="sm" onClick={() => onChange([...values, emptyVolunteer()])} className="h-7 gap-1 text-xs">
          <Plus size={12} /> 添加
        </Button>
      </div>

      {values.length === 0 && (
        <p className="text-xs text-[--color-text-muted]">暂无志愿经历，点击"添加"新增。</p>
      )}

      <div className="space-y-2">
        {values.map((v, i) => {
          const isCollapsed = collapsed.has(i)
          return (
            <div key={i} className="rounded-lg border border-[--color-border] bg-[--color-bg-hover]">
              <div className="flex items-center gap-2 px-3 py-2">
                <button type="button" onClick={() => toggle(i)} className="p-0.5 text-[--color-text-muted]">
                  {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                </button>
                <span className="flex-1 truncate text-sm font-medium">
                  {v.position || v.organization ? `${v.position}${v.position && v.organization ? " @ " : ""}${v.organization}` : `志愿经历 #${i + 1}`}
                </span>
                <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0 text-[--color-text-muted] hover:text-[--color-danger]" onClick={() => remove(i)}>
                  <Trash2 size={13} />
                </Button>
              </div>
              {!isCollapsed && (
                <div className="border-t border-[--color-border] p-3 space-y-3">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <Label className="text-xs text-[--color-text-secondary]">组织名称</Label>
                      <Input value={v.organization} onChange={(e) => update(i, "organization", e.target.value)} placeholder="组织" className="mt-1 h-8 text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs text-[--color-text-secondary]">职位 / 角色</Label>
                      <Input value={v.position} onChange={(e) => update(i, "position", e.target.value)} placeholder="如：教师" className="mt-1 h-8 text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs text-[--color-text-secondary]">组织链接</Label>
                      <Input value={v.url} onChange={(e) => update(i, "url", e.target.value)} placeholder="https://..." className="mt-1 h-8 text-sm" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs text-[--color-text-secondary]">开始时间</Label>
                        <Input value={v.startDate} onChange={(e) => update(i, "startDate", e.target.value)} type="month" className="mt-1 h-8 text-sm" />
                      </div>
                      <div>
                        <Label className="text-xs text-[--color-text-secondary]">结束时间</Label>
                        <Input value={v.endDate} onChange={(e) => update(i, "endDate", e.target.value)} type="month" disabled={v.current} className="mt-1 h-8 text-sm" />
                      </div>
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-[--color-text-secondary]">
                    <input type="checkbox" checked={v.current} onChange={(e) => update(i, "current", e.target.checked)} className="size-3.5" />
                    至今
                  </label>
                  <div>
                    <Label className="text-xs text-[--color-text-secondary]">描述</Label>
                    <Textarea value={v.summary} onChange={(e) => update(i, "summary", e.target.value)} placeholder="志愿工作内容概述" className="mt-1 h-20 text-sm" />
                  </div>
                  <ArrayField
                    label="亮点"
                    values={v.highlights}
                    onChange={(val) => update(i, "highlights", val)}
                    placeholder="一项贡献或亮点"
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
