"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export interface AdminThemeItem {
  slug: string
  pkg: string
  version: string
  description: string
  label: string
  available: boolean
  status: "verified" | "disabled" | "unverified"
  reason?: string
  verifiedAt?: string
  checkedAt?: string
  category: string
  sortOrder: number
  businessEnabled: boolean
  displayName: string | null
  defaultLocale: string | null
  defaultAppearance: string | null
  defaultConfig: Record<string, unknown>
  capabilities: {
    localeTitleSupport: string
    customOutputLabelSupport: string
    sectionOrderSupport: string
    appearanceSupport: string
    metaThemeSupport: string
    pdfSupport: string
    supportsChangeLanguage: boolean
    builtInLocales: string[]
    supportsDarkMode: boolean
  }
  visible: boolean
}

interface TemplateConfigDialogProps {
  theme: AdminThemeItem | null
  open: boolean
  onClose: () => void
  onSaved: () => void
}

export function TemplateConfigDialog({ theme, open, onClose, onSaved }: TemplateConfigDialogProps) {
  const [saving, setSaving] = useState(false)
  const [displayName, setDisplayName] = useState("")
  const [description, setDescription] = useState("")
  const [category, setCategory] = useState<string>("en")
  const [enabled, setEnabled] = useState(true)
  const [sortOrder, setSortOrder] = useState(0)
  const [defaultLocale, setDefaultLocale] = useState("")
  const [defaultAppearance, setDefaultAppearance] = useState<string>("system")
  const [defaultConfigJson, setDefaultConfigJson] = useState("{}")

  useEffect(() => {
    if (!theme) return
    setDisplayName(theme.displayName ?? theme.label ?? "")
    setDescription(theme.description ?? "")
    setCategory(theme.category ?? "en")
    setEnabled(theme.businessEnabled)
    setSortOrder(theme.sortOrder ?? 0)
    setDefaultLocale(theme.defaultLocale ?? "")
    setDefaultAppearance(theme.defaultAppearance ?? "system")
    setDefaultConfigJson(JSON.stringify(theme.defaultConfig ?? {}, null, 2))
  }, [theme])

  if (!open || !theme) return null

  async function handleSave() {
    let defaultConfig: Record<string, unknown> | undefined
    try {
      defaultConfig = JSON.parse(defaultConfigJson)
    } catch {
      toast.error("默认配置 JSON 格式错误")
      return
    }

    setSaving(true)
    try {
      const res = await fetch(`/api/admin/resume-themes/${theme!.slug}/config`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: displayName || null,
          description: description || null,
          category,
          enabled,
          sortOrder,
          defaultLocale: defaultLocale || null,
          defaultAppearance,
          defaultConfig,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "保存失败")
      toast.success("配置已保存")
      onSaved()
      onClose()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存失败")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center">
      <div className="flex w-full max-w-lg flex-col rounded-t-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface] p-5 shadow-lg sm:rounded-[--radius-lg] max-h-[90vh] overflow-y-auto">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold">编辑模板配置：{theme.label}</h3>
          <button onClick={onClose} className="p-1 text-[--color-text-muted] hover:text-[--color-text-primary]">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <Label className="text-xs">展示名称</Label>
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="mt-1 h-8 text-sm" />
          </div>

          <div>
            <Label className="text-xs">描述</Label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 w-full rounded-[--radius-sm] border border-[--color-border] bg-[--color-bg-surface] text-[--color-text-primary] px-3 py-2 text-sm"
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">分类</Label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="mt-1 h-8 w-full rounded-[--radius-sm] border border-[--color-border] bg-[--color-bg-surface] text-[--color-text-primary] px-2 text-xs"
              >
                <option value="zh">中文</option>
                <option value="en">英文</option>
              </select>
            </div>
            <div>
              <Label className="text-xs">排序</Label>
              <Input
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(Number(e.target.value))}
                className="mt-1 h-8 text-sm"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              id="enabled"
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="h-4 w-4 rounded border-[--color-border]"
            />
            <Label htmlFor="enabled" className="text-xs">业务启用（对用户可见）</Label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">默认语言</Label>
              <Input value={defaultLocale} onChange={(e) => setDefaultLocale(e.target.value)} placeholder="zh-CN" className="mt-1 h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs">默认外观</Label>
              <select
                value={defaultAppearance}
                onChange={(e) => setDefaultAppearance(e.target.value)}
                className="mt-1 h-8 w-full rounded-[--radius-sm] border border-[--color-border] bg-[--color-bg-surface] text-[--color-text-primary] px-2 text-xs"
              >
                <option value="system">跟随系统</option>
                <option value="light">浅色</option>
                <option value="dark">深色</option>
              </select>
            </div>
          </div>

          <div>
            <Label className="text-xs">默认配置（JSON）</Label>
            <textarea
              value={defaultConfigJson}
              onChange={(e) => setDefaultConfigJson(e.target.value)}
              className="mt-1 w-full rounded-[--radius-sm] border border-[--color-border] bg-[--color-bg-surface] text-[--color-text-primary] px-3 py-2 text-xs font-mono"
              rows={6}
            />
          </div>

          <div className="rounded-[--radius-sm] border border-[--color-border] bg-[--color-bg-hover] p-3">
            <p className="text-xs font-medium text-[--color-text-secondary] mb-1">能力声明（只读）</p>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-[--color-text-muted]">
              <span>locale: {theme.capabilities.localeTitleSupport}</span>
              <span>customLabel: {theme.capabilities.customOutputLabelSupport}</span>
              <span>sectionOrder: {theme.capabilities.sectionOrderSupport}</span>
              <span>appearance: {theme.capabilities.appearanceSupport}</span>
              <span>metaTheme: {theme.capabilities.metaThemeSupport}</span>
              <span>pdf: {theme.capabilities.pdfSupport}</span>
              <span>changeLanguage: {theme.capabilities.supportsChangeLanguage ? "是" : "否"}</span>
              <span>darkMode: {theme.capabilities.supportsDarkMode ? "是" : "否"}</span>
              <span className="col-span-2">builtInLocales: {theme.capabilities.builtInLocales.join(", ") || "无"}</span>
            </div>
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button size="sm" variant="outline" onClick={onClose}>取消</Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? "保存中..." : "保存"}
          </Button>
        </div>
      </div>
    </div>
  )
}
