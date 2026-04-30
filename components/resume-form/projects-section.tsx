"use client"

import type { ProjectForm } from "@/lib/resume/form-types"
import { emptyProject } from "@/lib/resume/form-types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ArrayField } from "./array-field"
import { Plus, Trash2, ChevronDown, ChevronRight } from "lucide-react"
import { useState } from "react"

export function ProjectsSection({
  values,
  onChange,
  title,
}: {
  values: ProjectForm[]
  onChange: (v: ProjectForm[]) => void
  title?: string
}) {
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set())

  function update(i: number, field: keyof ProjectForm, val: unknown) {
    const next = [...values]
    next[i] = { ...next[i], [field]: val }
    onChange(next)
  }

  function remove(i: number) {
    onChange(values.filter((_, idx) => idx !== i))
    setCollapsed((prev) => { const s = new Set(prev); s.delete(i); return s })
  }

  function add() {
    onChange([...values, emptyProject()])
  }

  function toggle(i: number) {
    setCollapsed((prev) => { const s = new Set(prev); if (s.has(i)) s.delete(i); else s.add(i); return s })
  }

  return (
    <section className="rounded-xl border border-[--color-border] bg-[--color-bg-surface] p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold">{title ?? "项目经历"}</h2>
        <Button type="button" variant="outline" size="sm" onClick={add} className="gap-1">
          <Plus size={13} /> 添加
        </Button>
      </div>
      {values.length === 0 && (
        <p className="text-xs text-[--color-text-muted]">暂无项目经历，点击"添加"新增。</p>
      )}
      <div className="space-y-3">
        {values.map((p, i) => {
          const isCollapsed = collapsed.has(i)
          return (
            <div key={i} className="rounded-lg border border-[--color-border] bg-[--color-bg-hover]">
              <div className="flex items-center gap-2 px-3 py-2">
                <button type="button" onClick={() => toggle(i)} className="p-0.5 text-[--color-text-muted]">
                  {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                </button>
                <span className="flex-1 text-sm font-medium truncate">
                  {p.name || `项目经历 #${i + 1}`}
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
                      <Label className="text-xs text-[--color-text-secondary]">项目名称</Label>
                      <Input value={p.name} onChange={(e) => update(i, "name", e.target.value)} placeholder="项目名称" className="mt-1 h-8 text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs text-[--color-text-secondary]">项目链接</Label>
                      <Input value={p.url} onChange={(e) => update(i, "url", e.target.value)} placeholder="https://..." className="mt-1 h-8 text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs text-[--color-text-secondary]">开始时间</Label>
                      <Input value={p.startDate} onChange={(e) => update(i, "startDate", e.target.value)} type="month" className="mt-1 h-8 text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs text-[--color-text-secondary]">结束时间</Label>
                      <Input value={p.endDate} onChange={(e) => update(i, "endDate", e.target.value)} type="month" className="mt-1 h-8 text-sm" />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-[--color-text-secondary]">项目描述</Label>
                    <Textarea value={p.description} onChange={(e) => update(i, "description", e.target.value)} placeholder="简要描述项目内容" className="mt-1 h-20 text-sm" />
                  </div>
                  <ArrayField
                    label="关键词"
                    values={p.keywords}
                    onChange={(v) => update(i, "keywords", v)}
                    placeholder="如 React, Node.js"
                  />
                  <ArrayField
                    label="亮点"
                    values={p.highlights}
                    onChange={(v) => update(i, "highlights", v)}
                    placeholder="一项成就或亮点"
                  />
                  <details className="rounded-md border border-[--color-border]">
                    <summary className="cursor-pointer select-none px-3 py-1.5 text-xs text-[--color-text-muted]">
                      更多字段（角色、机构、类型）
                    </summary>
                    <div className="border-t border-[--color-border] p-3 space-y-3">
                      <ArrayField
                        label="角色"
                        values={p.roles}
                        onChange={(v) => update(i, "roles", v)}
                        placeholder="如：Team lead"
                      />
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                          <label className="text-xs text-[--color-text-secondary]">所属机构</label>
                          <input value={p.entity} onChange={(e) => update(i, "entity", e.target.value)} placeholder="如：Google" className="mt-1 h-8 w-full rounded-[10px] border border-input bg-background px-3 text-sm" />
                        </div>
                        <div>
                          <label className="text-xs text-[--color-text-secondary]">项目类型</label>
                          <input value={p.type} onChange={(e) => update(i, "type", e.target.value)} placeholder="如：application" className="mt-1 h-8 w-full rounded-[10px] border border-input bg-background px-3 text-sm" />
                        </div>
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
