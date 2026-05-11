"use client"

import type { ProfileForm } from "@/lib/resume/form-types"
import { emptyProfile } from "@/lib/resume/form-types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, Trash2 } from "lucide-react"

export function ProfilesSection({
  values,
  onChange,
  title,
}: {
  values: ProfileForm[]
  onChange: (v: ProfileForm[]) => void
  title?: string
}) {
  function update(i: number, field: keyof ProfileForm, val: string) {
    const next = [...values]
    next[i] = { ...next[i], [field]: val }
    onChange(next)
  }

  function remove(i: number) {
    onChange(values.filter((_, idx) => idx !== i))
  }

  function add() {
    onChange([...values, emptyProfile()])
  }

  return (
    <section className="rounded-xl border border-[--color-border] bg-[--color-bg-surface] p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold">{title ?? "社交链接"}</h2>
        <Button type="button" variant="outline" size="sm" onClick={add} className="gap-1">
          <Plus size={13} /> 添加
        </Button>
      </div>
      {values.length === 0 && (
        <p className="text-xs text-[--color-text-muted]">暂无社交链接，点击&quot;添加&quot;新增。</p>
      )}
      <div className="space-y-3">
        {values.map((p, i) => (
          <div key={i} className="flex items-start gap-3 rounded-lg border border-[--color-border] bg-[--color-bg-hover] p-3">
            <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <Label className="text-xs text-[--color-text-secondary]">平台</Label>
                <Input
                  value={p.network}
                  onChange={(e) => update(i, "network", e.target.value)}
                  placeholder="如 GitHub"
                  className="mt-1 h-8 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs text-[--color-text-secondary]">用户名</Label>
                <Input
                  value={p.username}
                  onChange={(e) => update(i, "username", e.target.value)}
                  placeholder="用户名"
                  className="mt-1 h-8 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs text-[--color-text-secondary]">链接</Label>
                <Input
                  value={p.url}
                  onChange={(e) => update(i, "url", e.target.value)}
                  placeholder="https://..."
                  className="mt-1 h-8 text-sm"
                />
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-5 h-8 w-8 p-0 text-[--color-text-muted] hover:text-[--color-danger]"
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
