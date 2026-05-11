"use client"

import type { ReferenceForm } from "@/lib/resume/form-types"
import { emptyReference } from "@/lib/resume/form-types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Plus, Trash2 } from "lucide-react"

export function ReferencesSection({
  values,
  onChange,
  title,
}: {
  values: ReferenceForm[]
  onChange: (v: ReferenceForm[]) => void
  title?: string
}) {
  function update(i: number, field: keyof ReferenceForm, val: string) {
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
        <span className="text-xs font-semibold text-[--color-text-secondary]">{title ?? "推荐信"}</span>
        <Button type="button" variant="outline" size="sm" onClick={() => onChange([...values, emptyReference()])} className="h-7 gap-1 text-xs">
          <Plus size={12} /> 添加
        </Button>
      </div>

      {values.length === 0 && (
        <p className="text-xs text-[--color-text-muted]">暂无推荐信，点击&quot;添加&quot;新增。</p>
      )}

      <div className="space-y-2">
        {values.map((ref, i) => (
          <div key={i} className="rounded-lg border border-[--color-border] bg-[--color-bg-hover] p-3 space-y-3">
            <div className="flex items-start gap-2">
              <div className="flex-1 space-y-3">
                <div>
                  <Label className="text-xs text-[--color-text-secondary]">推荐人</Label>
                  <Input value={ref.name} onChange={(e) => update(i, "name", e.target.value)} placeholder="推荐人姓名" className="mt-1 h-8 text-sm" />
                </div>
                <div>
                  <Label className="text-xs text-[--color-text-secondary]">推荐内容</Label>
                  <Textarea value={ref.reference} onChange={(e) => update(i, "reference", e.target.value)} placeholder="推荐语内容" className="mt-1 h-20 text-sm" />
                </div>
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
