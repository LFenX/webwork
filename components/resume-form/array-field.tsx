"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, Trash2, GripVertical } from "lucide-react"

export function ArrayField({
  label,
  values,
  onChange,
  placeholder = "输入内容",
}: {
  label: string
  values: string[]
  onChange: (v: string[]) => void
  placeholder?: string
}) {
  function update(i: number, val: string) {
    const next = [...values]
    next[i] = val
    onChange(next)
  }

  function remove(i: number) {
    onChange(values.filter((_, idx) => idx !== i))
  }

  function add() {
    onChange([...values, ""])
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-[--color-text-secondary]">{label}</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0"
          onClick={add}
          title={`添加${label}`}
        >
          <Plus size={13} />
        </Button>
      </div>
      {values.map((v, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <GripVertical size={12} className="shrink-0 text-[--color-text-muted]" />
          <Input
            value={v}
            onChange={(e) => update(i, e.target.value)}
            placeholder={placeholder}
            className="h-8 flex-1 text-sm"
          />
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
      ))}
    </div>
  )
}
