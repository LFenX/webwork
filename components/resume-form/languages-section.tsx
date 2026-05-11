"use client"

import type { LanguageForm } from "@/lib/resume/form-types"
import { emptyLanguage } from "@/lib/resume/form-types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, Trash2 } from "lucide-react"

export function LanguagesSection({
  values,
  onChange,
  title,
}: {
  values: LanguageForm[]
  onChange: (v: LanguageForm[]) => void
  title?: string
}) {
  function update(i: number, field: keyof LanguageForm, val: string) {
    const next = [...values]
    next[i] = { ...next[i], [field]: val }
    onChange(next)
  }

  function remove(i: number) {
    onChange(values.filter((_, idx) => idx !== i))
  }

  function add() {
    onChange([...values, emptyLanguage()])
  }

  return (
    <section className="rounded-xl border border-[--color-border] bg-[--color-bg-surface] p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold">{title ?? "语言"}</h2>
        <Button type="button" variant="outline" size="sm" onClick={add} className="gap-1">
          <Plus size={13} /> 添加
        </Button>
      </div>
      {values.length === 0 && (
        <p className="text-xs text-[--color-text-muted]">暂无语言，点击&quot;添加&quot;新增。</p>
      )}
      <div className="space-y-2">
        {values.map((l, i) => (
          <div key={i} className="flex items-end gap-3 rounded-lg border border-[--color-border] bg-[--color-bg-hover] p-3">
            <div className="flex-1">
              <Label className="text-xs text-[--color-text-secondary]">语言</Label>
              <Input value={l.language} onChange={(e) => update(i, "language", e.target.value)} placeholder="如 中文" className="mt-1 h-8 text-sm" />
            </div>
            <div className="flex-1">
              <Label className="text-xs text-[--color-text-secondary]">熟练度</Label>
              <Input value={l.fluency} onChange={(e) => update(i, "fluency", e.target.value)} placeholder="如 母语 / 流利 / 基础" className="mt-1 h-8 text-sm" />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mb-0.5 h-8 w-8 p-0 text-[--color-text-muted] hover:text-[--color-danger]"
              onClick={() => remove(i)}
              title="删除"
            >
              <Trash2 size={13} />
            </Button>
          </div>
        ))}
      </div>
    </section>
  )
}
