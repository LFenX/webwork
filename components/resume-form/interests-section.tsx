"use client"

import type { InterestForm } from "@/lib/resume/form-types"
import { emptyInterest } from "@/lib/resume/form-types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ArrayField } from "./array-field"
import { Plus, Trash2 } from "lucide-react"

export function InterestsSection({
  values,
  onChange,
  title,
}: {
  values: InterestForm[]
  onChange: (v: InterestForm[]) => void
  title?: string
}) {
  function update(i: number, field: keyof InterestForm, val: unknown) {
    const next = [...values]
    next[i] = { ...next[i], [field]: val }
    onChange(next)
  }

  function remove(i: number) {
    onChange(values.filter((_, idx) => idx !== i))
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-[--color-text-secondary]">{title ?? "兴趣爱好"}</span>
        <Button type="button" variant="outline" size="sm" onClick={() => onChange([...values, emptyInterest()])} className="h-7 gap-1 text-xs">
          <Plus size={12} /> 添加
        </Button>
      </div>

      {values.length === 0 && (
        <p className="text-xs text-[--color-text-muted]">暂无兴趣，点击"添加"新增。</p>
      )}

      <div className="space-y-2">
        {values.map((int, i) => (
          <div key={i} className="rounded-lg border border-[--color-border] bg-[--color-bg-hover] p-3 space-y-3">
            <div className="flex items-start gap-2">
              <div className="flex-1 space-y-3">
                <div>
                  <Label className="text-xs text-[--color-text-secondary]">名称</Label>
                  <Input value={int.name} onChange={(e) => update(i, "name", e.target.value)} placeholder="如：户外运动" className="mt-1 h-8 text-sm" />
                </div>
                <ArrayField
                  label="关键词"
                  values={int.keywords}
                  onChange={(v) => update(i, "keywords", v)}
                  placeholder="如：登山、骑行"
                />
              </div>
              <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0 mt-0.5 text-[--color-text-muted] hover:text-[--color-danger]" onClick={() => remove(i)}>
                <Trash2 size={13} />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
