"use client"

import { useState } from "react"
import { Settings, ChevronDown, ChevronUp, Info } from "lucide-react"
import { Button } from "@/components/ui/button"

export interface OutputOptionsValue {
  locale: string
  appearance: "system" | "light" | "dark"
  sectionOrder: string[]
  hiddenSections: string[]
  fieldLabelMap: Record<string, string>
}

export interface CapabilityInfo {
  localeTitleSupport: string
  customOutputLabelSupport: string
  sectionOrderSupport: string
  appearanceSupport: string
  supportsChangeLanguage: boolean
  builtInLocales: string[]
  supportsDarkMode: boolean
}

interface OutputOptionsProps {
  value: OutputOptionsValue
  onChange: (v: OutputOptionsValue) => void
  capabilities: CapabilityInfo | null
  onOpenSectionManager: () => void
  onOpenFieldLabelEditor: () => void
}

const COMMON_LOCALES = ["auto", "zh-CN", "zh-TW", "en-gb", "en-US", "ja", "ko", "fr", "de", "es"]

export function OutputOptions({
  value,
  onChange,
  capabilities,
  onOpenSectionManager,
  onOpenFieldLabelEditor,
}: OutputOptionsProps) {
  const [expanded, setExpanded] = useState(false)

  const localeOptions = Array.from(
    new Set([...COMMON_LOCALES, ...(capabilities?.builtInLocales ?? [])])
  )

  const darkDisabled = capabilities?.appearanceSupport === "none"
  const localeHint =
    capabilities?.localeTitleSupport === "changeLanguage"
      ? "该模板支持自动语言切换"
      : capabilities?.localeTitleSupport === "metaLocale"
        ? "该模板通过 meta.locale 支持语言标识"
        : "该模板不支持自动语言切换，中文化请通过字段映射实现"

  const customLabelHint =
    capabilities?.customOutputLabelSupport === "none"
      ? "自定义标题只影响编辑表单，不保证影响最终输出"
      : capabilities?.customOutputLabelSupport === "metaHeadings"
        ? "自定义标题将通过 meta.theme.headings 影响最终输出"
        : "自定义标题将通过适配器补丁影响最终输出"

  return (
    <div className="rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface]">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium"
      >
        <span className="flex items-center gap-2">
          <Settings size={14} />
          输出选项
        </span>
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {expanded && (
        <div className="space-y-4 border-t border-[--color-border] px-4 pb-4 pt-3">
          {/* Locale */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1 text-xs font-medium">
              语言
              <span title={localeHint} className="cursor-help text-[--color-text-muted]">
                <Info size={12} />
              </span>
            </label>
            <select
              value={value.locale}
              onChange={(e) => onChange({ ...value, locale: e.target.value })}
              className="h-9 w-full rounded-[--radius-sm] border border-[--color-border] bg-[--color-bg-surface] text-[--color-text-primary] px-3 text-xs"
            >
              {localeOptions.map((loc) => (
                <option key={loc} value={loc}>
                  {loc === "auto" ? "自动（跟随站点设置）" : loc}
                </option>
              ))}
            </select>
            {capabilities?.localeTitleSupport === "none" && (
              <p className="text-xs text-amber-600">{localeHint}</p>
            )}
          </div>

          {/* Appearance */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium">外观</label>
            <div className="flex gap-2">
              {(["system", "light", "dark"] as const).map((a) => (
                <button
                  key={a}
                  type="button"
                  disabled={a === "dark" && darkDisabled}
                  onClick={() => onChange({ ...value, appearance: a })}
                  className={`flex-1 rounded-[--radius-sm] border px-3 py-2 text-xs transition-colors ${
                    value.appearance === a
                      ? "border-[--color-text-primary] bg-[--color-text-primary] text-white"
                      : "border-[--color-border] text-[--color-text-secondary] hover:bg-[--color-bg-hover]"
                  } ${a === "dark" && darkDisabled ? "cursor-not-allowed opacity-50" : ""}`}
                >
                  {a === "system" && "跟随系统"}
                  {a === "light" && "浅色"}
                  {a === "dark" && "深色"}
                </button>
              ))}
            </div>
            {darkDisabled && (
              <p className="text-xs text-[--color-text-muted]">该模板不支持深色模式</p>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onOpenSectionManager}>
              管理字段顺序与显示
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={onOpenFieldLabelEditor}>
              编辑字段标题
            </Button>
          </div>

          {capabilities?.customOutputLabelSupport === "none" && (
            <p className="text-xs text-amber-600">{customLabelHint}</p>
          )}
        </div>
      )}
    </div>
  )
}
