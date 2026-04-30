"use client"

import type { SkillForm } from "@/lib/resume/form-types"
import { emptySkill } from "@/lib/resume/form-types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ArrayField } from "./array-field"
import { Plus, Trash2, ChevronDown, ChevronRight } from "lucide-react"
import { useState } from "react"

export function SkillsSection({
  values,
  onChange,
  title,
}: {
  values: SkillForm[]
  onChange: (v: SkillForm[]) => void
  title?: string
}) {
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set())

  function update(i: number, field: keyof SkillForm, val: unknown) {
    const next = [...values]
    next[i] = { ...next[i], [field]: val }
    onChange(next)
  }

  function remove(i: number) {
    onChange(values.filter((_, idx) => idx !== i))
    setCollapsed((prev) => { const s = new Set(prev); s.delete(i); return s })
  }

  function add() {
    onChange([...values, emptySkill()])
  }

  function toggle(i: number) {
    setCollapsed((prev) => { const s = new Set(prev); if (s.has(i)) s.delete(i); else s.add(i); return s })
  }

  return (
    <section className="rounded-xl border border-[--color-border] bg-[--color-bg-surface] p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold">{title ?? "技能"}</h2>
        <Button type="button" variant="outline" size="sm" onClick={add} className="gap-1">
          <Plus size={13} /> 添加
        </Button>
      </div>
      {values.length === 0 && (
        <p className="text-xs text-[--color-text-muted]">暂无技能，点击"添加"新增。</p>
      )}
      <div className="space-y-3">
        {values.map((s, i) => {
          const isCollapsed = collapsed.has(i)
          return (
            <div key={i} className="rounded-lg border border-[--color-border] bg-[--color-bg-hover]">
              <div className="flex items-center gap-2 px-3 py-2">
                <button type="button" onClick={() => toggle(i)} className="p-0.5 text-[--color-text-muted]">
                  {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                </button>
                <span className="flex-1 text-sm font-medium truncate">
                  {s.name || `技能组 #${i + 1}`}
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
                      <Label className="text-xs text-[--color-text-secondary]">技能组名称</Label>
                      <Input value={s.name} onChange={(e) => update(i, "name", e.target.value)} placeholder="如 前端开发" className="mt-1 h-8 text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs text-[--color-text-secondary]">熟练度</Label>
                      <Input value={s.level} onChange={(e) => update(i, "level", e.target.value)} placeholder="如 精通 / 熟练 / 了解" className="mt-1 h-8 text-sm" />
                    </div>
                  </div>
                  <ArrayField
                    label="关键词"
                    values={s.keywords}
                    onChange={(v) => update(i, "keywords", v)}
                    placeholder="如 React, TypeScript"
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
