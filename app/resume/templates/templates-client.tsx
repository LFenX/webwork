"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ArrowLeft, Info } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ResumeThemeCard } from "@/components/resume-theme-card"
import { TemplateCategoryBoard } from "@/components/template-category-board"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { ResumeThemeInfo } from "@/lib/resume/types"

export function ResumeTemplatesClient({
  themes,
  categoryMap = {},
  sortOrderMap = {},
  currentThemeSlug,
  isOwner = false,
  snapshots = {},
}: {
  themes: ResumeThemeInfo[]
  categoryMap?: Record<string, string>
  sortOrderMap?: Record<string, number>
  currentThemeSlug: string | null
  isOwner?: boolean
  snapshots?: Record<string, string>
}) {
  const router = useRouter()
  const [previewTheme, setPreviewTheme] = useState<ResumeThemeInfo | null>(null)
  const [previewSrcDoc, setPreviewSrcDoc] = useState<string | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  async function openPreview(theme: ResumeThemeInfo) {
    setPreviewTheme(theme)
    setPreviewError(null)
    setPreviewLoading(false)

    if (!theme.available) {
      setPreviewSrcDoc(null)
      setPreviewError(theme.unavailableReason ?? "主题不可用")
      return
    }

    // 优先使用已注入的 snapshot（SSR 传递的小尺寸主题）
    if (snapshots[theme.slug]) {
      setPreviewSrcDoc(snapshots[theme.slug])
      return
    }

    // 按需从 snapshot API 加载（快照预先生成，不触发运行时 render）
    setPreviewSrcDoc(null)
    setPreviewLoading(true)
    try {
      const res = await fetch(`/api/resume/themes/snapshot?slug=${encodeURIComponent(theme.slug)}`, {
        cache: "no-store",
      })
      const data = await res.json()
      if (data.ok) {
        setPreviewSrcDoc(data.html)
      } else {
        setPreviewError(data.error || "暂无预览快照，请运行验证脚本生成")
      }
    } catch {
      setPreviewError("快照加载失败")
    } finally {
      setPreviewLoading(false)
    }
  }

  async function selectTheme(theme: ResumeThemeInfo) {
    try {
      const res = await fetch("/api/resume", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selectedTheme: theme.slug }),
        cache: "no-store",
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "切换失败")
      toast.success(`已切换至「${theme.label}」主题`)
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "切换主题失败")
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1440px] px-6 py-10 lg:px-10">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/resume" className="inline-flex items-center gap-1 text-sm text-[--color-text-muted] hover:text-[--color-text-primary] hover:no-underline">
          <ArrowLeft size={14} /> 返回简历
        </Link>
        {isOwner && (
          <Link
            href="/admin/resume-themes"
            className="inline-flex items-center gap-1.5 text-sm text-[--color-text-muted] hover:text-[--color-text-primary] hover:no-underline"
          >
            管理模板
          </Link>
        )}
      </div>

      <div className="mb-10">
        <h1 className="text-2xl font-semibold mb-2">简历模板中心</h1>
        <p className="text-sm text-[--color-text-secondary]">
          已启用 {themes.length} 个模板。同一份在线简历数据可以套用不同模板，每个模板都有独特的排版、配色和布局。
        </p>
        <details className="mt-2">
          <summary className="text-xs text-[--color-text-muted] cursor-pointer inline-flex items-center gap-1 hover:text-[--color-text-secondary]">
            <Info size={12} /> 如何添加新模板？
          </summary>
          <p className="mt-1 text-xs text-[--color-text-muted] ml-5">
            在项目根运行 <code className="text-[11px] bg-[--color-bg-hover] px-1 rounded">npm install jsonresume-theme-xxx</code>，
            再运行 <code className="text-[11px] bg-[--color-bg-hover] px-1 rounded">npm run resume:verify-themes</code> 验证并生成预览，最后重启 dev server。
          </p>
        </details>
      </div>

      {themes.length === 0 ? (
        <div className="rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface] p-12 text-center">
          <p className="text-sm text-[--color-text-muted]">暂无可用模板，请联系站点管理员验证模板。</p>
        </div>
      ) : (
        <TemplateCategoryBoard
          themes={themes}
          categoryMap={categoryMap}
          sortOrderMap={sortOrderMap}
          currentThemeSlug={currentThemeSlug}
          snapshots={snapshots}
          onSelect={(theme) => selectTheme(theme)}
          onPreview={(theme) => openPreview(theme)}
        />
      )}

      {/* Preview Modal */}
      <Dialog open={!!previewTheme} onOpenChange={() => setPreviewTheme(null)}>
        <DialogContent className="h-[95vh] max-h-[95vh] max-w-[1440px] sm:max-w-[1440px] w-[98vw] sm:w-[98vw] flex flex-col p-0 gap-0 overflow-hidden">
          <DialogHeader className="flex-shrink-0 px-6 pt-5 pb-3 border-b border-[--color-border]">
            <DialogTitle>
              {previewTheme?.label}
              {previewTheme?.version ? (
                <span className="ml-2 text-sm font-normal text-[--color-text-muted]">v{previewTheme.version}</span>
              ) : null}
              {" — 完整预览（示例数据）"}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-auto bg-[--color-bg-primary]">
            {previewLoading ? (
              <div className="flex items-center justify-center h-full text-sm text-[--color-text-muted]">
                加载预览...
              </div>
            ) : previewError ? (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-sm text-[--color-text-muted]">
                <p className="text-red-600 font-medium">无法加载预览</p>
                <p>{previewError}</p>
              </div>
            ) : previewSrcDoc ? (
              <div className="flex justify-center py-6 px-4">
                <iframe
                  srcDoc={previewSrcDoc}
                  title={`${previewTheme?.label ?? "简历"} 预览`}
                  sandbox="allow-same-origin"
                  className="border-0 block shadow-sm"
                  style={{ width: 1180, minHeight: 1500 }}
                />
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-sm text-[--color-text-muted]">
                暂无预览
              </div>
            )}
          </div>
          {previewTheme && (
            <div className="flex-shrink-0 flex justify-end px-6 pb-4 pt-3 border-t border-[--color-border]">
              <Button
                onClick={() => { selectTheme(previewTheme); setPreviewTheme(null) }}
                disabled={!previewTheme.available || previewTheme.slug === currentThemeSlug}
              >
                {!previewTheme.available
                  ? "主题不可用"
                  : previewTheme.slug === currentThemeSlug
                  ? "当前使用中"
                  : "使用此模板"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
