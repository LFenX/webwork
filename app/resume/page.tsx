import Link from "next/link"
import { Pencil, LayoutTemplate } from "lucide-react"
import { getResumeContent } from "@/lib/mdx"
import { requireAuth } from "@/lib/auth"
import { MarkdownContent } from "@/components/markdown-content"
import { ModuleVisibilitySelect } from "@/components/module-visibility-select"
import { PrintButton } from "@/components/print-button"
import { ResumePdfViewer } from "@/components/resume-pdf-viewer"
import { ResumeHtmlIframe } from "@/components/resume-html-iframe"
import { ResumeExportButton } from "@/components/resume-export-button"
import { renderResumeHtml } from "@/lib/resume/renderer"
import { getModuleVisibility } from "@/lib/permissions"
import { getDictionary } from "@/lib/i18n"
import { getUserSiteSettings } from "@/lib/settings"
import { resolveAdapterWithDb } from "@/lib/resume/template-config"
import { mergeEffectiveConfig, hashEffectiveConfig } from "@/lib/resume/adapters/registry"
import type { ResumeJson } from "@/lib/resume/types"

export const dynamic = "force-dynamic"
export const fetchCache = "force-no-store"

function isResumeContentSparse(resumeJson: ResumeJson): boolean {
  const basics = resumeJson.basics
  const summaryEmpty = !basics?.summary || basics.summary.length < 20
  const workEmpty = !Array.isArray(resumeJson.work) || resumeJson.work.length === 0
  const eduEmpty = !Array.isArray(resumeJson.education) || resumeJson.education.length === 0
  const skillsEmpty = !Array.isArray(resumeJson.skills) || resumeJson.skills.length === 0
  const projEmpty = !Array.isArray(resumeJson.projects) || resumeJson.projects.length === 0
  return summaryEmpty && workEmpty && eduEmpty && skillsEmpty && projEmpty
}

export default async function ResumePage() {
  const { userId } = await requireAuth()
  const [resume, visibility, settings] = await Promise.all([
    getResumeContent(userId),
    getModuleVisibility(userId, "resume"),
    getUserSiteSettings(userId),
  ])
  const dict = getDictionary(settings.language)
  const re = dict.resume

  type JsonResult =
    | { ok: true; html: string; usedThemeLabel: string; fallback: boolean; sparse: boolean; themeStale: boolean; configStale: boolean }
    | { ok: false; code: string; error: string }

  let jsonRenderResult: JsonResult | null = null
  const isJsonMode = resume.mode === "json"

  if (isJsonMode) {
    // 优先使用上次构建缓存的 HTML，不重新 require/render 第三方主题
    if (resume.renderedHtml) {
      const themeStale = !!(
        resume.selectedTheme &&
        resume.lastBuiltTheme &&
        resume.selectedTheme !== resume.lastBuiltTheme
      )
      let configStale = false
      if (resume.selectedTheme) {
        try {
          const adapter = await resolveAdapterWithDb(resume.selectedTheme)
          const effective = mergeEffectiveConfig(adapter, {
            resumeLocale: resume.resumeLocale,
            resumeAppearance: resume.resumeAppearance as "system" | "light" | "dark" | null,
            resumeConfig: (resume.resumeConfig as Record<string, unknown>) ?? null,
          })
          const currentHash = hashEffectiveConfig(effective)
          configStale = resume.lastBuiltConfigHash !== currentHash
        } catch {
          configStale = false
        }
      }
      jsonRenderResult = {
        ok: true,
        html: resume.renderedHtml,
        usedThemeLabel: resume.lastBuiltTheme ?? resume.selectedTheme ?? "默认主题",
        fallback: false,
        sparse: resume.resumeJson ? isResumeContentSparse(resume.resumeJson as ResumeJson) : false,
        themeStale,
        configStale,
      }
    } else if (resume.resumeJson) {
      // 兼容尚未使用 build API 的旧数据，仍可在线渲染一次
      try {
        const result = await renderResumeHtml({
          resumeJson: resume.resumeJson as ResumeJson,
          selectedTheme: resume.selectedTheme ?? null,
        })
        if (result.ok) {
          jsonRenderResult = {
            ok: true,
            html: result.html,
            usedThemeLabel: result.usedTheme.label,
            fallback: result.fallback,
            sparse: isResumeContentSparse(resume.resumeJson as ResumeJson),
            themeStale: false,
            configStale: false,
          }
        } else {
          jsonRenderResult = { ok: false, code: result.code, error: result.error }
        }
      } catch (err) {
        jsonRenderResult = {
          ok: false,
          code: "render_failed",
          error: err instanceof Error ? err.message : "未知错误",
        }
      }
    }
  }

  const containerClass = resume.mode === "pdf"
    ? "mx-auto w-full"
    : resume.mode === "json"
    ? "mx-auto w-full max-w-[1200px]"
    : "mx-auto max-w-[760px]"

  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-12 sm:px-8 sm:py-16">
      <div className={containerClass}>
        <div className="no-print mb-10 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-semibold">{re.title}</h1>
          <div className="flex items-center gap-3">
            <ModuleVisibilitySelect module="resume" initialVisibility={visibility} />
            {resume.mode === "markdown" && <PrintButton />}
            <Link
              href="/resume/templates"
              prefetch={false}
              className="inline-flex items-center gap-1.5 text-sm text-[--color-text-muted] transition-colors hover:text-[--color-text-primary] hover:no-underline"
            >
              <LayoutTemplate size={13} /> {re.templates ?? "模板"}
            </Link>
            <ResumeExportButton lastExportedAt={resume.lastExportedAt ?? null} />
            <Link
              href="/resume/edit"
              prefetch={false}
              className="inline-flex items-center gap-1.5 text-sm text-[--color-text-muted] transition-colors hover:text-[--color-text-primary] hover:no-underline"
            >
              <Pencil size={13} /> {re.edit}
            </Link>
          </div>
        </div>

        <div id="resume-content">
          {/* PDF mode */}
          {resume.mode === "pdf" && resume.pdfPath ? (
            <ResumePdfViewer src={resume.pdfPath} />
          ) : null}

          {/* JSON mode */}
          {isJsonMode && jsonRenderResult ? (
            jsonRenderResult.ok ? (
              <div>
                <div className="mb-4 flex flex-wrap items-center gap-3 text-xs text-[--color-text-muted]">
                  <span>{re.themeLabel ?? "主题"}：{jsonRenderResult.usedThemeLabel}</span>
                  {jsonRenderResult.fallback && (
                    <span className="text-amber-600">{re.themeFallback ?? "请求的主题不可用，已自动切换"}</span>
                  )}
                  {jsonRenderResult.themeStale && (
                    <span className="text-amber-600">
                      主题已更改，
                      <Link href="/resume/edit" className="underline">前往编辑页重新构建</Link>
                      以看到新主题效果
                    </span>
                  )}
                  {jsonRenderResult.configStale && (
                    <span className="text-amber-600">
                      输出配置已更改，
                      <Link href="/resume/edit" className="underline">前往编辑页重新构建</Link>
                      以应用最新配置
                    </span>
                  )}
                </div>
                {jsonRenderResult.sparse && (
                  <div className="mb-4 rounded-[--radius-md] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 flex flex-wrap items-center gap-3">
                    <span>当前在线简历内容还比较少，建议填写基本信息、教育经历、项目经历。</span>
                    <Link href="/resume/edit" className="font-medium underline whitespace-nowrap">去编辑</Link>
                    <Link href="/resume/templates" className="text-[--color-text-muted] underline whitespace-nowrap">查看模板示例效果</Link>
                  </div>
                )}
                <div className="mx-auto max-w-[1000px]">
                  <ResumeHtmlIframe srcDoc={jsonRenderResult.html} minHeight={800} viewportWidth={1000} mode="full" />
                </div>
              </div>
            ) : jsonRenderResult.code === "no_themes" ? (
              <div className="rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface] p-8 text-center">
                <p className="text-sm text-[--color-text-muted]">{re.noThemes ?? "还没有可用的简历主题。请先安装 jsonresume-theme-* 包"}</p>
              </div>
            ) : (
              <div className="rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface] p-8 text-center space-y-2">
                <p className="text-sm text-[--color-text-muted]">
                  {re.renderFailed ?? "简历渲染失败"}
                </p>
                <div className="flex justify-center gap-3 text-sm">
                  <Link href="/resume/edit" className="text-[--color-link] hover:underline">前往编辑并重新构建</Link>
                  <Link href="/resume/templates" className="text-[--color-link] hover:underline">切换其他主题</Link>
                </div>
              </div>
            )
          ) : null}

          {/* JSON mode — 有数据但尚未构建 */}
          {isJsonMode && !jsonRenderResult ? (
            <div className="rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface] p-8 text-center space-y-3">
              <p className="text-sm text-[--color-text-muted]">
                你还没有构建在线简历。请前往编辑页填写信息并点击「构建简历」。
              </p>
              <div className="flex items-center justify-center gap-3">
                <Link href="/resume/edit" className="inline-block text-sm font-medium text-white bg-[--color-text-primary] px-4 py-2 rounded-[--radius-sm] hover:opacity-90">
                  去编辑并构建
                </Link>
                <Link href="/resume/templates" className="inline-block text-sm text-[--color-link] hover:underline">
                  先看看模板效果
                </Link>
              </div>
            </div>
          ) : null}

          {/* Markdown mode (旧用户) */}
          {!isJsonMode && resume.mode !== "pdf" ? (
            resume.content ? (
              <div>
                <div className="mb-4 rounded-[--radius-md] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  {re.markdownBanner ?? "这是旧版 Markdown 内容。建议切换到在线简历以获得更好的展示效果。"}
                  {" "}
                  <Link href="/resume/edit" className="font-medium underline">
                    {re.switchToOnline ?? "切换为在线简历"}
                  </Link>
                </div>
                <MarkdownContent source={resume.content} />
              </div>
            ) : (
              <p className="text-[--color-text-muted]">{re.editHint}</p>
            )
          ) : null}
        </div>
      </div>
    </div>
  )
}
