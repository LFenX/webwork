"use client"

import { useState } from "react"
import { X, Plus, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type TabKey = "sections" | "fields" | "ui"

const CHINESE_SECTION_MAP: Record<string, string> = {
  basics: "基本信息",
  profiles: "社交链接",
  work: "工作经历",
  education: "教育经历",
  projects: "项目经历",
  skills: "技能",
  languages: "语言能力",
  awards: "获奖情况",
  publications: "出版物",
  interests: "兴趣爱好",
  volunteer: "志愿经历",
  references: "推荐信",
}

interface FieldLabelMapEditorProps {
  value: Record<string, string>
  onChange: (v: Record<string, string>) => void
  onClose: () => void
}

export function FieldLabelMapEditor({ value, onChange, onClose }: FieldLabelMapEditorProps) {
  const [tab, setTab] = useState<TabKey>("sections")
  const [entries, setEntries] = useState<[ string, string][]>(() => Object.entries(value))
  const [newKey, setNewKey] = useState("")
  const [newVal, setNewVal] = useState("")

  function updateEntries(next: [string, string][]) {
    setEntries(next)
    onChange(Object.fromEntries(next))
  }

  function addEntry() {
    if (!newKey.trim() || !newVal.trim()) return
    if (entries.some(([k]) => k === newKey.trim())) return
    updateEntries([...entries, [newKey.trim(), newVal.trim()]])
    setNewKey("")
    setNewVal("")
  }

  function removeEntry(key: string) {
    updateEntries(entries.filter(([k]) => k !== key))
  }

  function applyChinese() {
    const next = [...entries]
    for (const [en, zh] of Object.entries(CHINESE_SECTION_MAP)) {
      if (!next.some(([k]) => k === en)) {
        next.push([en, zh])
      }
    }
    updateEntries(next)
  }

  function reset() {
    updateEntries([])
  }

  const tabs: { key: TabKey; label: string }[] = [
    { key: "sections", label: "Sections" },
    { key: "fields", label: "Fields" },
    { key: "ui", label: "UI" },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center">
      <div className="flex w-full max-w-lg flex-col rounded-t-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface] p-4 shadow-lg sm:rounded-[--radius-lg] max-h-[85vh] overflow-y-auto">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">编辑字段标题</h3>
          <button onClick={onClose} className="p-1 text-[--color-text-muted] hover:text-[--color-text-primary]">
            <X size={16} />
          </button>
        </div>

        <div className="mb-3 flex gap-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`rounded-[--radius-sm] px-3 py-1.5 text-xs ${
                tab === t.key
                  ? "bg-[--color-text-primary] text-white"
                  : "bg-[--color-bg-hover] text-[--color-text-secondary]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="max-h-[50vh] space-y-2 overflow-y-auto">
          {entries.length === 0 && (
            <p className="text-xs text-[--color-text-muted]">暂无自定义映射</p>
          )}
          {entries.map(([k, v]) => (
            <div key={k} className="flex items-center gap-2">
              <Input value={k} readOnly className="h-8 flex-1 text-xs" />
              <Input
                value={v}
                onChange={(e) => {
                  const next = entries.map(([kk, vv]) => (kk === k ? [kk, e.target.value] : [kk, vv]))
                  updateEntries(next as [string, string][])
                }}
                className="h-8 flex-1 text-xs"
                maxLength={64}
              />
              <button onClick={() => removeEntry(k)} className="p-1 text-[--color-text-muted] hover:text-[--color-danger]">
                <X size={14} />
              </button>
            </div>
          ))}
        </div>

        <div className="mt-3 flex items-center gap-2">
          <Input
            placeholder="key"
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            className="h-8 flex-1 text-xs"
          />
          <Input
            placeholder="value"
            value={newVal}
            onChange={(e) => setNewVal(e.target.value)}
            className="h-8 flex-1 text-xs"
            maxLength={64}
          />
          <Button type="button" size="sm" variant="outline" onClick={addEntry} className="h-8 px-2">
            <Plus size={14} />
          </Button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={applyChinese}>
            一键应用中文映射
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={reset} className="gap-1">
            <RotateCcw size={12} /> 重置
          </Button>
          <div className="flex-1" />
          <Button size="sm" onClick={onClose}>完成</Button>
        </div>
      </div>
    </div>
  )
}
