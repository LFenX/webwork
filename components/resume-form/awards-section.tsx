"use client"

import type { AwardForm } from "@/lib/resume/form-types"
import { emptyAward } from "@/lib/resume/form-types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Plus, Trash2, ChevronDown, ChevronRight } from "lucide-react"
import { useState } from "react"

export function AwardsSection({
  values,
  onChange,
  title,
}: {
  values: AwardForm[]
  onChange: (v: AwardForm[]) => void
  title?: string
}) {
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set())

  function update(i: number, field: keyof AwardForm, val: string) {
    const next = [...values]
    next[i] = { ...next[i], [field]: val }
    onChange(next)
  }

  function remove(i: number) {
    onChange(values.filter((_, idx) => idx !== i))
    setCollapsed((prev) => { const s = new Set(prev); s.delete(i); return s })
  }

  function add() {
    onChange([...values, emptyAward()])
  }

  function toggle(i: number) {
    setCollapsed((prev) => { const s = new Set(prev); if (s.has(i)) s.delete(i); else s.add(i); return s })
  }

  return (
    <section className="rounded-xl border border-[--color-border] bg-[--color-bg-surface] p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold">{title ?? "奖项"}</h2>
        <Button type="button" variant="outline" size="sm" onClick={add} className="gap-1">
          <Plus size={13} /> 添加
        </Button>
      </div>
      {values.length === 0 && (
        <p className="text-xs text-[--color-text-muted]">暂无奖项，点击&quot;添加&quot;新增。</p>
      )}
      <div className="space-y-3">
        {values.map((a, i) => {
          const isCollapsed = collapsed.has(i)
          return (
            <div key={i} className="rounded-lg border border-[--color-border] bg-[--color-bg-hover]">
              <div className="flex items-center gap-2 px-3 py-2">
                <button type="button" onClick={() => toggle(i)} className="p-0.5 text-[--color-text-muted]">
                  {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                </button>
                <span className="flex-1 text-sm font-medium truncate">
                  {a.title || `奖项 #${i + 1}`}
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
                      <Label className="text-xs text-[--color-text-secondary]">名称</Label>
                      <Input value={a.title} onChange={(e) => update(i, "title", e.target.value)} placeholder="奖项名称" className="mt-1 h-8 text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs text-[--color-text-secondary]">颁发方</Label>
                      <Input value={a.awarder} onChange={(e) => update(i, "awarder", e.target.value)} placeholder="颁发机构" className="mt-1 h-8 text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs text-[--color-text-secondary]">日期</Label>
                      <Input value={a.date} onChange={(e) => update(i, "date", e.target.value)} type="month" className="mt-1 h-8 text-sm" />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-[--color-text-secondary]">简介</Label>
                    <Textarea value={a.summary} onChange={(e) => update(i, "summary", e.target.value)} placeholder="简要描述" className="mt-1 h-16 text-sm" />
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
