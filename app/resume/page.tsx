import Link from "next/link"
import { FileText, LayoutTemplate, Pencil } from "lucide-react"

import { MarkdownContent } from "@/components/markdown-content"
import { ModuleVisibilitySelect } from "@/components/module-visibility-select"
import { PrintButton } from "@/components/print-button"
import { ResumeExportButton } from "@/components/resume-export-button"
import { ResumeHtmlIframe } from "@/components/resume-html-iframe"
import { ResumePdfViewer } from "@/components/resume-pdf-viewer"
import { ModuleHero, ModulePageShell, ModulePanel, modulePillClass } from "@/components/module/module-shell"
import { requireAuth } from "@/lib/auth"
import { getDictionary } from "@/lib/i18n"
import { getResumeContent } from "@/lib/mdx"
import { getModuleVisibility } from "@/lib/permissions"
import { renderResumeHtml } from "@/lib/resume/renderer"
import { mergeEffectiveConfig, hashEffectiveConfig } from "@/lib/resume/adapters/registry"
import { resolveAdapterWithDb } from "@/lib/resume/template-config"
import type { ResumeJson } from "@/lib/resume/types"
import { getUserSiteSettings } from "@/lib/settings"

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
    | {
        ok: true
        html: string
        usedThemeLabel: string
        fallback: boolean
        sparse: boolean
        themeStale: boolean
        configStale: boolean
      }
    | { ok: false; code: string; error: string }

  let jsonRenderResult: JsonResult | null = null
  const isJsonMode = resume.mode === "json"

  if (isJsonMode) {
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
          configStale = resume.lastBuiltConfigHash !== hashEffectiveConfig(effective)
        } catch {
          configStale = false
        }
      }
      jsonRenderResult = {
        ok: true,
        html: resume.renderedHtml,
        usedThemeLabel: resume.lastBuiltTheme ?? resume.selectedTheme ?? "Default theme",
        fallback: false,
        sparse: resume.resumeJson ? isResumeContentSparse(resume.resumeJson as ResumeJson) : false,
        themeStale,
        configStale,
      }
    } else if (resume.resumeJson) {
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
          error: err instanceof Error ? err.message : "Unknown render error",
        }
      }
    }
  }

  const containerClass =
    resume.mode === "pdf"
      ? "mx-auto w-full"
      : resume.mode === "json"
        ? "mx-auto w-full max-w-[1200px]"
        : "mx-auto w-full max-w-[820px]"

  const modeLabel = resume.mode === "pdf" ? "PDF" : resume.mode === "json" ? "Online JSON" : "Markdown"
  const visibilityLabel = visibility === "friends" ? "Friends" : "Private"

  return (
    <ModulePageShell maxWidth="wide">
      <div className="space-y-5">
        <ModuleHero
          icon={FileText}
          title={re.title ?? "Resume"}
          description="Manage your online resume, PDF version, templates, and exports in one clean workspace."
          stats={[
            { label: "Mode", value: modeLabel },
            { label: "Visibility", value: visibilityLabel },
          ]}
          actions={
            <div className="no-print flex flex-wrap items-center gap-2">
              <ModuleVisibilitySelect module="resume" initialVisibility={visibility} />
              {resume.mode === "markdown" && <PrintButton />}
              <Link href="/resume/templates" prefetch={false} className={modulePillClass(false)}>
                <LayoutTemplate size={15} /> {re.templates ?? "Templates"}
              </Link>
              <ResumeExportButton lastExportedAt={resume.lastExportedAt ?? null} />
              <Link href="/resume/edit" prefetch={false} className={modulePillClass(true)}>
                <Pencil size={15} /> {re.edit ?? "Edit"}
              </Link>
            </div>
          }
        />

        <ModulePanel className={containerClass} contentClassName={resume.mode === "pdf" ? "p-0" : "p-6 sm:p-8"}>
          <div id="resume-content">
            {resume.mode === "pdf" && resume.pdfPath ? <ResumePdfViewer src={resume.pdfPath} /> : null}

            {isJsonMode && jsonRenderResult ? (
              jsonRenderResult.ok ? (
                <div>
                  <div className="mb-4 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                    <span>{re.themeLabel ?? "Theme"}: {jsonRenderResult.usedThemeLabel}</span>
                    {jsonRenderResult.fallback && (
                      <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-700">
                        {re.themeFallback ?? "Requested theme is unavailable, using fallback."}
                      </span>
                    )}
                    {jsonRenderResult.themeStale && (
                      <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-700">
                        Theme changed. <Link href="/resume/edit" className="underline">Rebuild resume</Link>.
                      </span>
                    )}
                    {jsonRenderResult.configStale && (
                      <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-700">
                        Export config changed. <Link href="/resume/edit" className="underline">Rebuild resume</Link>.
                      </span>
                    )}
                  </div>
                  {jsonRenderResult.sparse && (
                    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-[18px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                      <span>Your online resume still looks sparse. Add profile, education, work, project, or skill details for a richer result.</span>
                      <Link href="/resume/edit" className="font-medium underline">Edit resume</Link>
                      <Link href="/resume/templates" className="text-amber-700 underline">Preview templates</Link>
                    </div>
                  )}
                  <div className="mx-auto max-w-[1000px]">
                    <ResumeHtmlIframe srcDoc={jsonRenderResult.html} minHeight={800} viewportWidth={1000} mode="full" />
                  </div>
                </div>
              ) : jsonRenderResult.code === "no_themes" ? (
                <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-8 text-center">
                  <p className="text-sm text-slate-500">{re.noThemes ?? "No resume theme is available yet."}</p>
                </div>
              ) : (
                <div className="space-y-3 rounded-[22px] border border-slate-200 bg-slate-50 p-8 text-center">
                  <p className="text-sm text-slate-500">{re.renderFailed ?? "Resume rendering failed."}</p>
                  <div className="flex justify-center gap-3 text-sm">
                    <Link href="/resume/edit" className="font-medium text-blue-600 hover:underline">Edit and rebuild</Link>
                    <Link href="/resume/templates" className="font-medium text-blue-600 hover:underline">Switch theme</Link>
                  </div>
                </div>
              )
            ) : null}

            {isJsonMode && !jsonRenderResult ? (
              <div className="space-y-3 rounded-[22px] border border-dashed border-blue-200 bg-blue-50/60 p-8 text-center">
                <p className="text-sm text-slate-600">Build your online resume from the editor to preview it here.</p>
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <Link href="/resume/edit" className={modulePillClass(true)}>
                    Edit and build
                  </Link>
                  <Link href="/resume/templates" className={modulePillClass(false)}>
                    Browse templates
                  </Link>
                </div>
              </div>
            ) : null}

            {!isJsonMode && resume.mode !== "pdf" ? (
              resume.content ? (
                <div>
                  <div className="mb-4 rounded-[18px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    {re.markdownBanner ?? "This is legacy Markdown resume content. Switch to the online resume for a better presentation."}{" "}
                    <Link href="/resume/edit" className="font-medium underline">
                      {re.switchToOnline ?? "Switch to online resume"}
                    </Link>
                  </div>
                  <MarkdownContent source={resume.content} />
                </div>
              ) : (
                <div className="rounded-[22px] border border-dashed border-blue-200 bg-blue-50/60 p-8 text-center text-sm text-slate-600">
                  {re.editHint ?? "No resume content yet."}
                </div>
              )
            ) : null}
          </div>
        </ModulePanel>
      </div>
    </ModulePageShell>
  )
}
