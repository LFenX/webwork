"use client"

import type { EducationForm } from "@/lib/resume/form-types"
import { emptyEducation } from "@/lib/resume/form-types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ArrayField } from "./array-field"
import { Plus, Trash2, ChevronDown, ChevronRight } from "lucide-react"
import { useState } from "react"

export function EducationSection({
  values,
  onChange,
  title,
}: {
  values: EducationForm[]
  onChange: (v: EducationForm[]) => void
  title?: string
}) {
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set())

  function update(i: number, field: keyof EducationForm, val: unknown) {
    const next = [...values]
    next[i] = { ...next[i], [field]: val }
    onChange(next)
  }

  function remove(i: number) {
    onChange(values.filter((_, idx) => idx !== i))
    setCollapsed((prev) => { const s = new Set(prev); s.delete(i); return s })
  }

  function add() {
    onChange([...values, emptyEducation()])
  }

  function toggle(i: number) {
    setCollapsed((prev) => { const s = new Set(prev); if (s.has(i)) s.delete(i); else s.add(i); return s })
  }

  return (
    <section className="rounded-xl border border-[--color-border] bg-[--color-bg-surface] p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold">{title ?? "教育经历"}</h2>
        <Button type="button" variant="outline" size="sm" onClick={add} className="gap-1">
          <Plus size={13} /> 添加
        </Button>
      </div>
      {values.length === 0 && (
        <p className="text-xs text-[--color-text-muted]">暂无教育经历，点击"添加"新增。</p>
      )}
      <div className="space-y-3">
        {values.map((e, i) => {
          const isCollapsed = collapsed.has(i)
          return (
            <div key={i} className="rounded-lg border border-[--color-border] bg-[--color-bg-hover]">
              <div className="flex items-center gap-2 px-3 py-2">
                <button type="button" onClick={() => toggle(i)} className="p-0.5 text-[--color-text-muted]">
                  {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                </button>
                <span className="flex-1 text-sm font-medium truncate">
                  {e.institution || `教育经历 #${i + 1}`}
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
                      <Label className="text-xs text-[--color-text-secondary]">学校</Label>
                      <Input value={e.institution} onChange={(v) => update(i, "institution", v.target.value)} placeholder="学校名称" className="mt-1 h-8 text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs text-[--color-text-secondary]">学校链接</Label>
                      <Input value={e.url} onChange={(v) => update(i, "url", v.target.value)} placeholder="https://..." className="mt-1 h-8 text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs text-[--color-text-secondary]">专业</Label>
                      <Input value={e.area} onChange={(v) => update(i, "area", v.target.value)} placeholder="专业方向" className="mt-1 h-8 text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs text-[--color-text-secondary]">学历</Label>
                      <Input value={e.studyType} onChange={(v) => update(i, "studyType", v.target.value)} placeholder="如 本科 / 硕士" className="mt-1 h-8 text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs text-[--color-text-secondary]">开始时间</Label>
                      <Input value={e.startDate} onChange={(v) => update(i, "startDate", v.target.value)} type="month" className="mt-1 h-8 text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs text-[--color-text-secondary]">结束时间</Label>
                      <Input value={e.endDate} onChange={(v) => update(i, "endDate", v.target.value)} type="month" className="mt-1 h-8 text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs text-[--color-text-secondary]">成绩</Label>
                      <Input value={e.score} onChange={(v) => update(i, "score", v.target.value)} placeholder="如 GPA 3.8/4.0" className="mt-1 h-8 text-sm" />
                    </div>
                  </div>
                  <ArrayField
                    label="课程"
                    values={e.courses}
                    onChange={(v) => update(i, "courses", v)}
                    placeholder="课程名称"
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
