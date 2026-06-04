"use client"

import { useEffect, useRef, useState } from "react"
import { Loader2, X, Check } from "lucide-react"
import { toast } from "sonner"

export type LatexDocConfig = {
  templateId: string
  theme: string
  palette: string
  cover: boolean
  toc: boolean
  headerFooter: boolean
  fontSize: number
  margin: string
  lineSpacing: string
  cjkFont: string
  paragraphStyle: string
  paperSize: string
  title: string
  subtitle: string
  author: string
  date: string
}

export type LatexTemplateInfo = {
  id: string
  name: string
  description: string
  defaults: Partial<LatexDocConfig>
  bodyGuide: string
  suggestedTheme?: string
}

export type LatexThemeInfo = { id: string, name: string, description: string }

export type LatexPaletteInfo = { id: string, name: string, accent: string }

export type LatexCatalogue = { templates: LatexTemplateInfo[], themes: LatexThemeInfo[], palettes: LatexPaletteInfo[] }

const FONT_SIZES = [10, 11, 12]
const MARGINS: Array<{ id: string, label: string }> = [
  { id: "narrow", label: "紧凑" },
  { id: "normal", label: "标准" },
  { id: "wide", label: "宽松" },
]
const SPACINGS: Array<{ id: string, label: string }> = [
  { id: "compact", label: "紧密" },
  { id: "normal", label: "标准" },
  { id: "relaxed", label: "舒展" },
]
const CJK_FONTS: Array<{ id: string, label: string }> = [
  { id: "auto", label: "跟随主题" },
  { id: "songti", label: "宋体" },
  { id: "heiti", label: "黑体" },
  { id: "kaiti", label: "楷体" },
  { id: "fangsong", label: "仿宋" },
  { id: "dengxian", label: "等线" },
  { id: "yahei", label: "雅黑" },
  { id: "shsong", label: "思源宋体" },
  { id: "shhei", label: "思源黑体" },
]
const PARAGRAPHS: Array<{ id: string, label: string }> = [
  { id: "indent", label: "首行缩进" },
  { id: "spaced", label: "段间距" },
]
const PAPERS: Array<{ id: string, label: string }> = [
  { id: "a4", label: "A4" },
  { id: "letter", label: "Letter" },
]

function Segmented<T extends string | number>({ value, options, onChange }: {
  value: T
  options: Array<{ id: T, label: string }>
  onChange: (v: T) => void
}) {
  return (
    <div className="inline-flex rounded-lg bg-slate-100 p-0.5">
      {options.map((opt) => (
        <button
          key={String(opt.id)}
          type="button"
          onClick={() => onChange(opt.id)}
          className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${value === opt.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

function Toggle({ checked, onChange, label }: { checked: boolean, onChange: (v: boolean) => void, label: string }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="flex items-center gap-2 text-sm text-slate-700">
      <span className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${checked ? "bg-blue-600" : "bg-slate-300"}`}>
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${checked ? "translate-x-4" : "translate-x-0.5"}`} />
      </span>
      {label}
    </button>
  )
}

export function LatexTemplateModal({
  conversationId,
  config,
  catalogue,
  onClose,
  onSaved,
}: {
  conversationId: string | null
  config: LatexDocConfig
  catalogue: LatexCatalogue
  onClose: () => void
  onSaved: (config: LatexDocConfig) => void
}) {
  const [draft, setDraft] = useState<LatexDocConfig>(config)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [saving, setSaving] = useState(false)
  const previewUrlRef = useRef<string | null>(null)

  // Re-sync the draft when the parent config object changes (e.g. 蝶灵 updated it
  // live). This is the React "adjust state during render" pattern, not an effect.
  const [syncedConfig, setSyncedConfig] = useState(config)
  if (config !== syncedConfig) {
    setSyncedConfig(config)
    setDraft(config)
  }

  useEffect(() => () => { if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current) }, [])

  const selectedTemplate = catalogue.templates.find((t) => t.id === draft.templateId) ?? catalogue.templates[0]

  function patch(next: Partial<LatexDocConfig>) {
    setDraft((d) => ({ ...d, ...next }))
  }

  function selectTemplate(id: string) {
    const t = catalogue.templates.find((tpl) => tpl.id === id)
    if (!t) return
    // Switching content type adopts its suggested theme too (a deliberate
    // restyle); the user can still pick a different theme afterwards.
    setDraft((d) => ({ ...d, ...t.defaults, templateId: id, theme: t.suggestedTheme ?? d.theme }))
  }

  async function generatePreview() {
    setPreviewing(true)
    try {
      const res = await fetch("/api/latex-documents/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: draft }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error ?? "预览生成失败")
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
      previewUrlRef.current = url
      setPreviewUrl(url)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "预览生成失败")
    } finally {
      setPreviewing(false)
    }
  }

  async function save() {
    if (!conversationId) {
      toast.info("请先发送一条消息开始对话，再保存模板配置。")
      return
    }
    setSaving(true)
    try {
      const res = await fetch("/api/latex-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, patch: draft }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.config) throw new Error(data?.error ?? "保存失败")
      onSaved(data.config as LatexDocConfig)
      toast.success("模板配置已保存")
      onClose()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存失败")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="flex max-h-[88vh] w-full max-w-[1080px] flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">PDF 模板与样式</h2>
            <p className="mt-0.5 text-xs text-slate-500">选择内容类型、视觉主题、配色与版式，蝶灵生成 PDF 时将使用该配置</p>
          </div>
          <button type="button" onClick={onClose} className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 overflow-hidden md:grid-cols-[300px_1fr]">
          {/* Template list */}
          <div className="min-h-0 overflow-y-auto border-r border-slate-100 p-3">
            <div className="grid grid-cols-2 gap-2 md:grid-cols-1">
              {catalogue.templates.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => selectTemplate(t.id)}
                  className={`group flex flex-col overflow-hidden rounded-xl border text-left transition-all ${draft.templateId === t.id ? "border-blue-500 ring-2 ring-blue-100" : "border-slate-200 hover:border-slate-300"}`}
                >
                  <div className="relative aspect-[3/4] w-full overflow-hidden bg-slate-50">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/latex-previews/${t.id}.png`} alt={t.name} className="h-full w-full object-cover object-top" loading="lazy" />
                    {draft.templateId === t.id ? (
                      <span className="absolute right-1.5 top-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white">
                        <Check size={12} />
                      </span>
                    ) : null}
                  </div>
                  <div className="px-2.5 py-1.5">
                    <div className="truncate text-xs font-semibold text-slate-800">{t.name}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Params + preview */}
          <div className="min-h-0 overflow-y-auto p-5">
            <p className="text-sm font-semibold text-slate-900">{selectedTemplate?.name}</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">{selectedTemplate?.description}</p>

            {/* Visual theme — controls fonts, headings, cover and component look */}
            <div className="mt-5">
              <div className="mb-2 text-xs font-semibold text-slate-700">视觉主题<span className="ml-1 font-normal text-slate-400">字体 / 标题 / 封面 / 组件外观</span></div>
              <div className="grid grid-cols-3 gap-2">
                {catalogue.themes.map((th) => (
                  <button
                    key={th.id}
                    type="button"
                    onClick={() => patch({ theme: th.id })}
                    title={th.description}
                    className={`group flex flex-col overflow-hidden rounded-lg border text-left transition-all ${draft.theme === th.id ? "border-blue-500 ring-2 ring-blue-100" : "border-slate-200 hover:border-slate-300"}`}
                  >
                    <div className="relative aspect-[3/4] w-full overflow-hidden bg-slate-50">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`/latex-previews/themes/${th.id}.png`} alt={th.name} className="h-full w-full object-cover object-top" loading="lazy" />
                      {draft.theme === th.id ? (
                        <span className="absolute right-1 top-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-white">
                          <Check size={10} />
                        </span>
                      ) : null}
                    </div>
                    <div className="px-2 py-1.5">
                      <div className="truncate text-[11px] font-semibold text-slate-800">{th.name}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Palette */}
            <div className="mt-5">
              <div className="mb-2 text-xs font-semibold text-slate-700">配色方案</div>
              <div className="flex flex-wrap gap-2">
                {catalogue.palettes.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    title={p.name}
                    onClick={() => patch({ palette: p.id })}
                    className={`h-7 w-7 rounded-full border-2 transition-transform hover:scale-110 ${draft.palette === p.id ? "border-slate-900" : "border-white shadow"}`}
                    style={{ backgroundColor: `#${p.accent}` }}
                  />
                ))}
              </div>
            </div>

            {/* Layout toggles */}
            <div className="mt-5">
              <div className="mb-2 text-xs font-semibold text-slate-700">版式</div>
              <div className="flex flex-wrap gap-x-6 gap-y-2">
                <Toggle checked={draft.cover} onChange={(v) => patch({ cover: v })} label="封面页" />
                <Toggle checked={draft.toc} onChange={(v) => patch({ toc: v })} label="目录" />
                <Toggle checked={draft.headerFooter} onChange={(v) => patch({ headerFooter: v })} label="页眉页脚" />
              </div>
            </div>

            {/* Density */}
            <div className="mt-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700">字号</span>
                <Segmented value={draft.fontSize} options={FONT_SIZES.map((s) => ({ id: s, label: `${s}pt` }))} onChange={(v) => patch({ fontSize: v })} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700">页边距</span>
                <Segmented value={draft.margin} options={MARGINS} onChange={(v) => patch({ margin: v })} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700">行距</span>
                <Segmented value={draft.lineSpacing} options={SPACINGS} onChange={(v) => patch({ lineSpacing: v })} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700">正文字体</span>
                <select
                  value={draft.cjkFont}
                  onChange={(e) => patch({ cjkFont: e.target.value })}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700 outline-none focus:border-blue-400"
                >
                  {CJK_FONTS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
                </select>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700">段落</span>
                <Segmented value={draft.paragraphStyle} options={PARAGRAPHS} onChange={(v) => patch({ paragraphStyle: v })} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700">纸张</span>
                <Segmented value={draft.paperSize} options={PAPERS} onChange={(v) => patch({ paperSize: v })} />
              </div>
            </div>

            {/* Doc info */}
            <div className="mt-5 grid grid-cols-2 gap-3">
              <label className="col-span-2 text-xs font-semibold text-slate-700">文档信息</label>
              <input value={draft.title} onChange={(e) => patch({ title: e.target.value })} placeholder="标题" className="col-span-2 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400" />
              <input value={draft.subtitle} onChange={(e) => patch({ subtitle: e.target.value })} placeholder="副标题" className="col-span-2 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400" />
              <input value={draft.author} onChange={(e) => patch({ author: e.target.value })} placeholder="作者" className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400" />
              <input value={draft.date} onChange={(e) => patch({ date: e.target.value })} placeholder="日期（留空为今天）" className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400" />
            </div>

            {/* Preview */}
            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700">实时预览</span>
                <button type="button" onClick={generatePreview} disabled={previewing} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60">
                  {previewing ? <Loader2 size={13} className="animate-spin" /> : null}
                  {previewing ? "编译中…" : "生成预览"}
                </button>
              </div>
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                {previewUrl ? (
                  <iframe title="preview" src={previewUrl} className="h-[420px] w-full" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/latex-previews/${draft.templateId}.png`} alt="preview" className="max-h-[420px] w-full object-contain" />
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-6 py-3">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">取消</button>
          <button type="button" onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60">
            {saving ? <Loader2 size={14} className="animate-spin" /> : null}
            保存配置
          </button>
        </div>
      </div>
    </div>
  )
}
