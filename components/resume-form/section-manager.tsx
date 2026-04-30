"use client"

import { ArrowDown, ArrowUp, Eye, EyeOff, X } from "lucide-react"
import { Button } from "@/components/ui/button"

const ALL_SECTIONS = [
  { id: "basics", label: "基本信息" },
  { id: "profiles", label: "社交链接" },
  { id: "work", label: "工作经历" },
  { id: "education", label: "教育经历" },
  { id: "projects", label: "项目经历" },
  { id: "skills", label: "技能" },
  { id: "languages", label: "语言" },
  { id: "awards", label: "奖项" },
  { id: "publications", label: "出版物" },
  { id: "interests", label: "兴趣爱好" },
  { id: "volunteer", label: "志愿经历" },
  { id: "references", label: "推荐信" },
]

interface SectionManagerProps {
  sectionOrder: string[]
  hiddenSections: string[]
  onChange: (sectionOrder: string[], hiddenSections: string[]) => void
  onClose: () => void
  sectionOrderSupport?: string
}

export function SectionManager({
  sectionOrder,
  hiddenSections,
  onChange,
  onClose,
  sectionOrderSupport,
}: SectionManagerProps) {
  const ordered = sectionOrder.filter((id) => ALL_SECTIONS.some((s) => s.id === id))
  const missing = ALL_SECTIONS.filter((s) => !ordered.includes(s.id)).map((s) => s.id)
  const fullOrder = [...ordered, ...missing]

  function moveUp(index: number) {
    if (index <= 0) return
    const next = [...fullOrder]
    const [item] = next.splice(index, 1)
    next.splice(index - 1, 0, item)
    onChange(next, hiddenSections)
  }

  function moveDown(index: number) {
    if (index >= fullOrder.length - 1) return
    const next = [...fullOrder]
    const [item] = next.splice(index, 1)
    next.splice(index + 1, 0, item)
    onChange(next, hiddenSections)
  }

  function toggleHidden(id: string) {
    if (id === "basics") return // cannot hide basics
    const next = hiddenSections.includes(id)
      ? hiddenSections.filter((s) => s !== id)
      : [...hiddenSections, id]
    onChange(fullOrder, next)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center">
      <div className="flex w-full max-w-md flex-col rounded-t-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface] p-4 shadow-lg sm:rounded-[--radius-lg] max-h-[85vh] overflow-y-auto">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">管理字段顺序与显示</h3>
          <button onClick={onClose} className="p-1 text-[--color-text-muted] hover:text-[--color-text-primary]">
            <X size={16} />
          </button>
        </div>

        {sectionOrderSupport === "none" && (
          <p className="mb-2 text-xs text-amber-600">
            该主题输出顺序固定，排序只影响编辑表单。
          </p>
        )}

        <div className="max-h-[60vh] space-y-2 overflow-y-auto">
          {fullOrder.map((id, index) => {
            const section = ALL_SECTIONS.find((s) => s.id === id)!
            const isHidden = hiddenSections.includes(id)
            const isBasics = id === "basics"
            return (
              <div
                key={id}
                className={`flex items-center gap-2 rounded-[--radius-sm] border px-3 py-2 text-sm ${
                  isHidden ? "border-dashed opacity-60" : "border-[--color-border]"
                }`}
              >
                <div className="flex flex-col gap-0.5">
                  <button
                    type="button"
                    onClick={() => moveUp(index)}
                    disabled={index <= 0}
                    className="text-[--color-text-muted] disabled:opacity-30"
                  >
                    <ArrowUp size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveDown(index)}
                    disabled={index >= fullOrder.length - 1}
                    className="text-[--color-text-muted] disabled:opacity-30"
                  >
                    <ArrowDown size={12} />
                  </button>
                </div>
                <span className="flex-1">{section.label}</span>
                <button
                  type="button"
                  onClick={() => toggleHidden(id)}
                  disabled={isBasics}
                  title={isBasics ? "基本信息不可隐藏" : isHidden ? "显示" : "隐藏"}
                  className="p-1 text-[--color-text-muted] disabled:opacity-30"
                >
                  {isHidden ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            )
          })}
        </div>

        <div className="mt-4 flex justify-end">
          <Button size="sm" onClick={onClose}>完成</Button>
        </div>
      </div>
    </div>
  )
}
