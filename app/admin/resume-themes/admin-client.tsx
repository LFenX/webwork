"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { ArrowLeft, Check, ShieldAlert, AlertTriangle, RefreshCw, Ban, Copy, Terminal, Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import { TemplateConfigDialog } from "@/components/template-config-dialog"
import { copyTextWithToast } from "@/lib/interaction-feedback"

interface ThemeItem {
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

interface ThemeListData {
  themes: ThemeItem[]
  counts: { total: number; verified: number; disabled: number; unverified: number }
}

export function ResumeThemesAdminClient() {
  const [data, setData] = useState<ThemeListData | null>(null)
  const [loading, setLoading] = useState(true)
  const [disablingSlug, setDisablingSlug] = useState<string | null>(null)
  const CLI_CMD = "npm run resume:verify-themes"

  const [editingTheme, setEditingTheme] = useState<ThemeItem | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/resume-themes")
      if (!res.ok) throw new Error("加载失败")
      setData(await res.json())
    } catch { toast.error("加载主题列表失败") }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  function copyCmd() {
    void copyTextWithToast(CLI_CMD, "已复制命令", "复制失败，请手动复制")
  }

  async function handleDisable(slug: string, reason: string) {
    const r = prompt("禁用原因：", reason || "管理员手动禁用")
    if (r === null) return
    setDisablingSlug(slug)
    try {
      const res = await fetch("/api/admin/resume-themes/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ themeSlug: slug, reason: r }),
      })
      if (!res.ok) throw new Error()
      toast.success(`${slug} 已禁用`)
      load()
    } catch { toast.error("禁用失败") }
    finally { setDisablingSlug(null) }
  }

  if (loading) {
    return <div className="mx-auto max-w-[960px] px-6 py-10 text-sm text-[--color-text-muted]">加载中...</div>
  }

  if (!data) return null

  const groups = {
    verified: data.themes.filter((t) => t.status === "verified"),
    disabled: data.themes.filter((t) => t.status === "disabled"),
    unverified: data.themes.filter((t) => t.status === "unverified"),
  }

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-10">
      <div className="mb-6">
        <Link href="/admin" className="inline-flex items-center gap-1 text-sm text-[--color-text-muted] hover:text-[--color-text-primary] hover:no-underline">
          <ArrowLeft size={14} /> 管理后台
        </Link>
      </div>

      <div className="flex items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-xl font-semibold">简历模板管理</h1>
          <p className="text-sm text-[--color-text-muted] mt-1">
            已验证 {data.counts.verified} / 已禁用 {data.counts.disabled} / 待验证 {data.counts.unverified} / 共 {data.counts.total}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <code className="text-xs bg-[--color-bg-hover] px-2 py-1 rounded select-all">{CLI_CMD}</code>
          <Button size="sm" variant="outline" onClick={copyCmd} className="gap-1 text-xs"><Copy size={12} /> 复制</Button>
          <Button size="sm" variant="outline" onClick={load} className="gap-1 text-xs"><RefreshCw size={12} /> 刷新</Button>
        </div>
      </div>

      {/* Verified */}
      <Section title="已验证可用" icon={<Check size={16} className="text-green-600" />} count={groups.verified.length}>
        {groups.verified.map((t) => (
          <ThemeRow
            key={t.slug}
            theme={t}
            actions={
              <>
                <Button size="sm" variant="ghost" onClick={() => { setEditingTheme(t); setDialogOpen(true) }} className="gap-1 text-xs">
                  <Settings size={12} /> 配置
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleDisable(t.slug, t.reason || "")} loading={disablingSlug === t.slug} loadingText="禁用中..." className="gap-1 text-xs">
                  <Ban size={12} /> 禁用
                </Button>
              </>
            }
          />
        ))}
      </Section>

      {/* Unverified */}
      <Section title="待验证" icon={<AlertTriangle size={16} className="text-amber-500" />} count={groups.unverified.length}>
        {groups.unverified.map((t) => (
          <ThemeRow
            key={t.slug}
            theme={t}
            actions={
              <>
                <Button size="sm" variant="ghost" onClick={() => { setEditingTheme(t); setDialogOpen(true) }} className="gap-1 text-xs">
                  <Settings size={12} /> 配置
                </Button>
                <span className="text-xs text-[--color-text-muted] inline-flex items-center gap-1">
                  <Terminal size={12} /> 请运行 CLI 验证
                </span>
              </>
            }
          />
        ))}
        {groups.unverified.length === 0 && <p className="text-sm text-[--color-text-muted] py-4 px-4">所有主题已处理。</p>}
      </Section>

      {/* Disabled */}
      <Section title="已禁用 / 验证失败" icon={<ShieldAlert size={16} className="text-red-500" />} count={groups.disabled.length}>
        {groups.disabled.map((t) => (
          <ThemeRow
            key={t.slug}
            theme={t}
            reason={t.reason}
            actions={
              <>
                <Button size="sm" variant="ghost" onClick={() => { setEditingTheme(t); setDialogOpen(true) }} className="gap-1 text-xs">
                  <Settings size={12} /> 配置
                </Button>
                <span className="text-xs text-[--color-text-muted] inline-flex items-center gap-1">
                  <Terminal size={12} /> 需 CLI 重新验证
                </span>
              </>
            }
          />
        ))}
      </Section>

      <TemplateConfigDialog
        theme={editingTheme}
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSaved={() => load()}
      />
    </div>
  )
}

function Section({ title, icon, count, children }: { title: string; icon: React.ReactNode; count: number; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h2 className="text-sm font-semibold">{title} ({count})</h2>
      </div>
      <div className="rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface] divide-y divide-[--color-border]">
        {children}
      </div>
    </div>
  )
}

function ThemeRow({ theme, reason, actions }: { theme: ThemeItem; reason?: string; actions: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm">{theme.label}</span>
          <span className="text-xs text-[--color-text-muted] font-mono">{theme.pkg} @ {theme.version || "?"}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-[--color-border] text-[--color-text-muted]">
            {theme.category === "zh" ? "中文" : "英文"} · 排序 {theme.sortOrder}
          </span>
          {!theme.businessEnabled && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-200">
              已停用
            </span>
          )}
        </div>
        {theme.description && <p className="text-xs text-[--color-text-secondary] mt-0.5">{theme.description}</p>}
        {reason && <p className="text-xs text-red-500 mt-0.5">{reason}</p>}
        {theme.verifiedAt && <p className="text-[10px] text-[--color-text-muted] mt-0.5">验证时间：{theme.verifiedAt}</p>}
        {theme.checkedAt && !theme.verifiedAt && <p className="text-[10px] text-[--color-text-muted] mt-0.5">检查时间：{theme.checkedAt}</p>}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {actions}
      </div>
    </div>
  )
}
