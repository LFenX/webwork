"use client"

import { useEffect, useMemo, useState } from "react"
import { AlertTriangle, Ban, Check, Copy, LayoutDashboard, Palette, RefreshCw, Settings, ShieldAlert, Sparkles, Terminal } from "lucide-react"
import { toast } from "sonner"
import { AdminEmptyState, AdminPanel, AdminShell, AdminStatCard, AdminToolbar, type AdminNavItem } from "@/components/admin/admin-shell"
import { AdminContentLoading } from "@/components/loading/app-loading-states"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
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

type ThemeFilter = "all" | ThemeItem["status"]

const CLI_CMD = "npm run resume:verify-themes"

export function ResumeThemesAdminClient() {
  const [data, setData] = useState<ThemeListData | null>(null)
  const [loading, setLoading] = useState(true)
  const [disablingSlug, setDisablingSlug] = useState<string | null>(null)
  const [disableTarget, setDisableTarget] = useState<ThemeItem | null>(null)
  const [disableReason, setDisableReason] = useState("")
  const [filter, setFilter] = useState<ThemeFilter>("all")
  const [editingTheme, setEditingTheme] = useState<ThemeItem | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  const navItems: AdminNavItem[] = [
    { key: "overview", label: "后台概览", href: "/admin?section=overview", icon: <LayoutDashboard size={17} />, description: "回到主后台" },
    { key: "resume-themes", label: "简历主题", href: "/admin/resume-themes", icon: <Palette size={17} />, description: "主题验证与配置" },
    { key: "roundtable", label: "圆桌管理", href: "/channels/soulwing-roundtable", icon: <Sparkles size={17} />, description: "蝶灵圆桌控制台" },
  ]

  async function load(showLoading = true) {
    if (showLoading) setLoading(true)
    try {
      const res = await fetch("/api/admin/resume-themes")
      if (!res.ok) throw new Error("加载失败")
      setData(await res.json())
    } catch {
      toast.error("加载主题列表失败")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    fetch("/api/admin/resume-themes")
      .then(async (res) => {
        if (!res.ok) throw new Error("加载失败")
        const payload = (await res.json()) as ThemeListData
        if (!cancelled) setData(payload)
      })
      .catch(() => {
        if (!cancelled) toast.error("加载主题列表失败")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const visibleThemes = useMemo(() => {
    if (!data) return []
    if (filter === "all") return data.themes
    return data.themes.filter((theme) => theme.status === filter)
  }, [data, filter])

  function copyCmd() {
    void copyTextWithToast(CLI_CMD, "已复制命令", "复制失败，请手动复制")
  }

  function openDisableDialog(theme: ThemeItem) {
    setDisableTarget(theme)
    setDisableReason(theme.reason || "管理员手动禁用")
  }

  async function confirmDisable() {
    if (!disableTarget) return
    setDisablingSlug(disableTarget.slug)
    try {
      const res = await fetch("/api/admin/resume-themes/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ themeSlug: disableTarget.slug, reason: disableReason.trim() || "管理员手动禁用" }),
      })
      if (!res.ok) throw new Error()
      toast.success(`${disableTarget.slug} 已禁用`)
      setDisableTarget(null)
      await load()
    } catch {
      toast.error("禁用失败")
    } finally {
      setDisablingSlug(null)
    }
  }

  return (
    <AdminShell
      title="简历主题管理"
      description="验证、配置和下线简历主题。主题列表在卡片内滚动，避免后台页面被长列表拉得过高。"
      eyebrow="Owner Console"
      navItems={navItems}
      activeKey="resume-themes"
      backHref="/admin?section=overview"
      backLabel="管理后台"
      actions={
        <>
          <Button variant="outline" onClick={copyCmd}>
            <Copy size={14} />
            复制验证命令
          </Button>
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            <RefreshCw size={14} />
            {loading ? "刷新中..." : "刷新"}
          </Button>
        </>
      }
    >
      {loading ? (
        <AdminContentLoading />
      ) : data ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <AdminStatCard label="全部主题" value={data.counts.total} icon={<Palette size={18} />} />
            <AdminStatCard label="已验证" value={data.counts.verified} icon={<Check size={18} />} tone="green" />
            <AdminStatCard label="待验证" value={data.counts.unverified} icon={<AlertTriangle size={18} />} tone="orange" />
            <AdminStatCard label="已禁用" value={data.counts.disabled} icon={<ShieldAlert size={18} />} tone="rose" />
          </div>

          <AdminPanel
            title="主题工作台"
            description="筛选主题状态，配置主题默认项，或禁用不适合上线的主题。"
            icon={<Palette size={18} />}
          >
            <AdminToolbar>
              <div className="flex flex-wrap gap-2">
                {([
                  ["all", "全部", data.counts.total],
                  ["verified", "已验证", data.counts.verified],
                  ["unverified", "待验证", data.counts.unverified],
                  ["disabled", "已禁用", data.counts.disabled],
                ] as const).map(([key, label, count]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setFilter(key)}
                    className={`inline-flex min-h-10 items-center gap-2 rounded-full px-4 text-sm font-medium transition ${
                      filter === key
                        ? "bg-blue-600 text-white shadow-[0_10px_22px_rgba(37,99,235,0.22)]"
                        : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-blue-50 hover:text-blue-700"
                    }`}
                  >
                    {label}
                    <span className={filter === key ? "text-blue-100" : "text-slate-400"}>{count}</span>
                  </button>
                ))}
              </div>
              <code className="max-w-full overflow-x-auto rounded-full bg-white px-3 py-2 font-mono text-xs text-slate-500 ring-1 ring-slate-200">{CLI_CMD}</code>
            </AdminToolbar>

            <div className="mt-4 max-h-[720px] overflow-y-auto rounded-[18px] border border-slate-200 bg-white">
              {visibleThemes.length === 0 ? (
                <AdminEmptyState title="没有匹配的主题" description="切换筛选条件查看其他主题状态。" icon={<Palette size={18} />} />
              ) : (
                <div className="divide-y divide-slate-100">
                  {visibleThemes.map((theme) => (
                    <ThemeRow
                      key={theme.slug}
                      theme={theme}
                      disabling={disablingSlug === theme.slug}
                      onConfigure={() => {
                        setEditingTheme(theme)
                        setDialogOpen(true)
                      }}
                      onDisable={() => openDisableDialog(theme)}
                    />
                  ))}
                </div>
              )}
            </div>
          </AdminPanel>

          <AdminPanel title="验证说明" description="主题包升级或新增后，先运行验证命令，再刷新这里查看状态。" icon={<Terminal size={18} />}>
            <div className="rounded-[18px] border border-dashed border-slate-200 bg-slate-50/70 p-4">
              <p className="text-sm font-medium text-slate-800">验证命令</p>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
                <code className="min-w-0 flex-1 overflow-x-auto rounded-[14px] bg-white px-3 py-2 font-mono text-sm text-slate-600 ring-1 ring-slate-200">{CLI_CMD}</code>
                <Button variant="outline" onClick={copyCmd}>
                  <Copy size={14} />
                  复制
                </Button>
              </div>
            </div>
          </AdminPanel>
        </>
      ) : null}

      <Dialog open={Boolean(disableTarget)} onOpenChange={(open) => !open && setDisableTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>禁用主题</DialogTitle>
            <DialogDescription>
              {disableTarget ? `请填写 ${disableTarget.label || disableTarget.slug} 的禁用原因，便于后续排查和恢复。` : "请填写禁用原因。"}
            </DialogDescription>
          </DialogHeader>
          <textarea
            value={disableReason}
            onChange={(event) => setDisableReason(event.target.value)}
            className="min-h-28 w-full rounded-[16px] border border-slate-200 bg-slate-50 p-3 text-sm outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100"
            placeholder="例如：渲染失败、样式异常、依赖未安装..."
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDisableTarget(null)}>
              取消
            </Button>
            <Button onClick={confirmDisable} loading={Boolean(disableTarget && disablingSlug === disableTarget.slug)} loadingText="禁用中...">
              确认禁用
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TemplateConfigDialog
        theme={editingTheme}
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSaved={() => void load()}
      />
    </AdminShell>
  )
}

function ThemeRow({
  theme,
  disabling,
  onConfigure,
  onDisable,
}: {
  theme: ThemeItem
  disabling: boolean
  onConfigure: () => void
  onDisable: () => void
}) {
  const status = statusMeta(theme.status)
  return (
    <div className="flex flex-col gap-4 px-4 py-4 transition hover:bg-blue-50/40 lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-slate-900">{theme.label}</span>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-[11px] text-slate-500">
            {theme.pkg} @ {theme.version || "?"}
          </span>
          <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${status.className}`}>
            {status.label}
          </span>
          <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-500">
            {theme.category === "zh" ? "中文" : "英文"} · 排序 {theme.sortOrder}
          </span>
          {!theme.businessEnabled ? (
            <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
              业务停用
            </span>
          ) : null}
        </div>
        {theme.description ? <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-500">{theme.description}</p> : null}
        {theme.reason ? <p className="mt-1 text-xs text-rose-600">{theme.reason}</p> : null}
        <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-slate-400">
          {theme.verifiedAt ? <span>验证时间：{theme.verifiedAt}</span> : null}
          {theme.checkedAt && !theme.verifiedAt ? <span>检查时间：{theme.checkedAt}</span> : null}
          <span>可见：{theme.visible ? "是" : "否"}</span>
          <span>深色：{theme.capabilities.supportsDarkMode ? "支持" : "不支持"}</span>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={onConfigure}>
          <Settings size={13} />
          配置
        </Button>
        {theme.status !== "disabled" ? (
          <Button size="sm" variant="outline" onClick={onDisable} loading={disabling} loadingText="禁用中..." className="text-rose-600">
            <Ban size={13} />
            禁用
          </Button>
        ) : (
          <span className="inline-flex min-h-9 items-center gap-1 rounded-full bg-slate-50 px-3 text-xs text-slate-500 ring-1 ring-slate-200">
            <Terminal size={12} />
            需 CLI 重新验证
          </span>
        )}
      </div>
    </div>
  )
}

function statusMeta(status: ThemeItem["status"]) {
  if (status === "verified") {
    return { label: "已验证", className: "border-emerald-200 bg-emerald-50 text-emerald-700" }
  }
  if (status === "disabled") {
    return { label: "已禁用", className: "border-rose-200 bg-rose-50 text-rose-700" }
  }
  return { label: "待验证", className: "border-amber-200 bg-amber-50 text-amber-700" }
}
