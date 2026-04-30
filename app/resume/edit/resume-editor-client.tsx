"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ArrowLeft, Copy, Download, FileText, LayoutTemplate, Trash2, Upload } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ResumeForm, DEFAULT_SECTION_ORDER } from "@/components/resume-form/resume-form"
import { FormActionsBar } from "@/components/resume-form/form-actions-bar"
import { TemplateReadinessBanner } from "@/components/resume-form/template-readiness-banner"
import { OutputOptions, type OutputOptionsValue, type CapabilityInfo } from "@/components/resume-form/output-options"
import { SectionManager } from "@/components/resume-form/section-manager"
import { FieldLabelMapEditor } from "@/components/resume-form/field-label-map-editor"
import { resumeJsonToFormState, formStateToResumeJson } from "@/lib/resume/form-transform"
import { emptyFormState } from "@/lib/resume/form-types"
import type { ResumeFormState } from "@/lib/resume/form-types"
import type { ResumeThemeInfo } from "@/lib/resume/types"
import { checkResumeBuildReadiness } from "@/lib/resume/build-readiness"
import { readUserStorage, removeUserStorage, userStorageKey, writeUserStorage } from "@/lib/client-storage"
import { confirmAction, copyTextWithToast } from "@/lib/interaction-feedback"
import { formatChinaDateTime } from "@/lib/time"

interface ResumeEditorClientProps {
  userId: string
  initialContent: string
  initialMode: string
  initialPdfPath: string | null
  initialResumeJson: unknown | null
  initialSelectedTheme: string | null
  themes: ResumeThemeInfo[]
}

type ResumeVersion = {
  id: string
  name: string
  pdfPath: string
  originalName: string
  size: number
  createdAt: string
}

const DRAFT_TTL_MS = 30 * 24 * 60 * 60 * 1000

function buildInitialFormState(resumeJson: unknown): ResumeFormState {
  if (resumeJson && typeof resumeJson === "object") {
    try {
      return resumeJsonToFormState(resumeJson as Record<string, unknown>)
    } catch {
      // fall through
    }
  }
  return emptyFormState()
}

export function ResumeEditorClient({
  userId, initialContent, initialMode, initialPdfPath,
  initialResumeJson, initialSelectedTheme, themes,
}: ResumeEditorClientProps) {
  const router = useRouter()
  const initialTab = initialMode === "pdf" ? "pdf" : "online"
  const [tab, setTab] = useState<"pdf" | "online">(initialTab)

  // PDF state (unchanged)
  const [pdfPath, setPdfPath] = useState(initialPdfPath)
  const [versions, setVersions] = useState<ResumeVersion[]>([])
  const [versionName, setVersionName] = useState("")
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Online resume form state
  const [formState, setFormState] = useState<ResumeFormState>(() =>
    buildInitialFormState(initialResumeJson),
  )
  const [selectedTheme, setSelectedTheme] = useState<string | null>(initialSelectedTheme)
  const [savingDraft, setSavingDraft] = useState(false)
  const [building, setBuilding] = useState(false)

  const [outputOptions, setOutputOptions] = useState<OutputOptionsValue>({
    locale: "auto",
    appearance: "system",
    sectionOrder: DEFAULT_SECTION_ORDER,
    hiddenSections: [],
    fieldLabelMap: {},
  })
  const [capabilities, setCapabilities] = useState<CapabilityInfo | null>(null)
  const [showSectionManager, setShowSectionManager] = useState(false)
  const [showFieldLabelEditor, setShowFieldLabelEditor] = useState(false)
  const configLoadedRef = useRef(false)
  const loadedConfigJsonRef = useRef<string | null>(null)
  const saveConfigTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const availableThemes = themes.filter((t) => t.available)

  // Draft system
  const draftKey = userStorageKey(userId, "resume-form-draft", "v1")
  const draftReady = useRef(false)

  // Fetch versions
  useEffect(() => {
    fetch("/api/resume/versions", { cache: "no-store" })
      .then((res) => res.ok ? res.json() : [])
      .then((items: ResumeVersion[]) => setVersions(items))
      .catch(() => setVersions([]))
  }, [])

  // Draft restore
  useEffect(() => {
    const draft = readUserStorage<{ formState: ResumeFormState; selectedTheme: string | null }>({
      kind: "local",
      key: draftKey,
      userId,
      ttlMs: DRAFT_TTL_MS,
    })
    if (draft?.formState) {
      const initialForm = buildInitialFormState(initialResumeJson)
      const draftJson = JSON.stringify(draft.formState)
      const initialJson = JSON.stringify(initialForm)
      if (draftJson !== initialJson) {
        if (confirmAction("检测到未保存的在线简历草稿，是否恢复？恢复后会覆盖当前编辑器里的初始内容。", "")) {
          window.setTimeout(() => {
            setFormState(draft.formState)
            if (draft.selectedTheme !== undefined) setSelectedTheme(draft.selectedTheme)
            toast.success("已恢复本地草稿")
          }, 0)
        }
      }
    }
    draftReady.current = true
  }, [draftKey, initialResumeJson, userId])

  // Draft save (debounced)
  const saveDraftTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!draftReady.current || tab !== "online") return
    if (saveDraftTimer.current) clearTimeout(saveDraftTimer.current)
    saveDraftTimer.current = setTimeout(() => {
      const initialForm = buildInitialFormState(initialResumeJson)
      const draftJson = JSON.stringify(formState)
      const initialJson = JSON.stringify(initialForm)
      if (draftJson === initialJson && selectedTheme === initialSelectedTheme) {
        removeUserStorage("local", draftKey)
        return
      }
      writeUserStorage({ kind: "local", key: draftKey, userId, value: { formState, selectedTheme } })
    }, 500)
    return () => { if (saveDraftTimer.current) clearTimeout(saveDraftTimer.current) }
  }, [formState, selectedTheme, draftKey, initialResumeJson, initialSelectedTheme, tab, userId])

  // BeforeUnload
  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (!draftReady.current) return
      const draft = readUserStorage<{ formState: unknown }>({ kind: "local", key: draftKey, userId, ttlMs: DRAFT_TTL_MS })
      if (!draft) return
      event.preventDefault()
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => window.removeEventListener("beforeunload", handleBeforeUnload)
  }, [draftKey, userId])

  // Load user output config
  useEffect(() => {
    fetch("/api/resume/config", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) {
          configLoadedRef.current = true
          return
        }
        const nested = (data.config?.fieldLabelMap ?? {}) as Record<string, Record<string, string>>
        const flatMap: Record<string, string> = {
          ...(nested.sections ?? {}),
          ...(nested.fields ?? {}),
          ...(nested.ui ?? {}),
        }
        const opts: OutputOptionsValue = {
          locale: data.locale ?? "auto",
          appearance: data.appearance ?? "system",
          sectionOrder: data.config?.sectionOrder ?? DEFAULT_SECTION_ORDER,
          hiddenSections: data.config?.hiddenSections ?? [],
          fieldLabelMap: flatMap,
        }
        setOutputOptions(opts)
        loadedConfigJsonRef.current = JSON.stringify(opts)
        configLoadedRef.current = true
      })
      .catch(() => {
        configLoadedRef.current = true
      })
  }, [])

  // Fetch effective config (capabilities) when theme changes
  useEffect(() => {
    const slug = selectedTheme ?? ""
    fetch(`/api/resume/effective-config?slug=${encodeURIComponent(slug)}`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data?.capabilities) {
          setCapabilities(null)
          return
        }
        setCapabilities(data.capabilities)
      })
      .catch(() => setCapabilities(null))
  }, [selectedTheme])

  // Auto-save output config
  useEffect(() => {
    if (!configLoadedRef.current) return
    const currentJson = JSON.stringify(outputOptions)
    if (currentJson === loadedConfigJsonRef.current) return
    if (saveConfigTimerRef.current) clearTimeout(saveConfigTimerRef.current)
    saveConfigTimerRef.current = setTimeout(() => {
      fetch("/api/resume/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locale: outputOptions.locale,
          appearance: outputOptions.appearance,
          config: {
            sectionOrder: outputOptions.sectionOrder,
            hiddenSections: outputOptions.hiddenSections,
            fieldLabelMap: { sections: outputOptions.fieldLabelMap },
          },
        }),
      })
        .then((res) => {
          if (!res.ok) throw new Error("保存失败")
          loadedConfigJsonRef.current = currentJson
        })
        .catch(() => {
          toast.error("输出选项自动保存失败")
        })
    }, 800)
    return () => {
      if (saveConfigTimerRef.current) clearTimeout(saveConfigTimerRef.current)
    }
  }, [outputOptions])

  // ─── PDF handlers (unchanged) ───

  async function handlePdfUpload(file: File) {
    const name = versionName.trim()
    if (!name) { toast.error("请先填写版本名"); return }
    setUploading(true)
    try {
      const form = new FormData()
      form.append("file", file)
      form.append("name", name)
      const res = await fetch("/api/resume/upload", { method: "POST", body: form, cache: "no-store" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "上传失败")
      setPdfPath(data.version.pdfPath)
      setTab("pdf")
      setVersions((current) => [data.version, ...current])
      setVersionName("")
      toast.success("PDF 已保存为新版本")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "上传失败")
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  async function handleSavePdfMode() {
    setSavingDraft(true)
    try {
      const res = await fetch("/api/resume", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "pdf", pdfPath }),
        cache: "no-store",
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "保存失败")
      toast.success("已切换至 PDF 展示模式")
      router.push("/resume")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存失败")
    } finally { setSavingDraft(false) }
  }

  async function setCurrentVersion(version: ResumeVersion) {
    setSavingDraft(true)
    try {
      const res = await fetch(`/api/resume/versions/${version.id}`, { method: "PATCH", cache: "no-store" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(data.error || "切换失败"); return }
      setPdfPath(version.pdfPath)
      setTab("pdf")
      toast.success("已设为展示版本")
    } finally {
      setSavingDraft(false)
    }
  }

  async function deleteVersion(version: ResumeVersion) {
    if (!confirmAction(`确认删除简历版本「${version.name}」？删除后该 PDF 版本将无法在版本列表中恢复。`)) return
    setSavingDraft(true)
    try {
      const res = await fetch(`/api/resume/versions/${version.id}`, { method: "DELETE", cache: "no-store" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(data.error || "删除失败"); return }
      setVersions((current) => current.filter((item) => item.id !== version.id))
      toast.success("版本已删除")
    } finally {
      setSavingDraft(false)
    }
  }

  // ─── Online resume handlers ───

  async function handleSaveDraft() {
    setSavingDraft(true)
    try {
      const resumeJson = formStateToResumeJson(formState)
      const body: Record<string, unknown> = { mode: "json", resumeJson }
      if (selectedTheme) body.selectedTheme = selectedTheme
      const res = await fetch("/api/resume", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        cache: "no-store",
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || data.issues?.join(", ") || "保存草稿失败")
      removeUserStorage("local", draftKey)
      toast.success("草稿已保存")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存草稿失败")
    } finally { setSavingDraft(false) }
  }

  async function handleBuild() {
    // Client-side readiness check before calling API
    const resumeJson = formStateToResumeJson(formState)
    const report = checkResumeBuildReadiness(resumeJson, selectedTheme)

    if (!report.canBuild) {
      const msgs = report.missingRequiredFields.map((f) => f.errorMsg).join(" · ")
      toast.error(`无法构建：${msgs}`)
      return
    }

    if (report.missingRecommendedFields.length > 0) {
      const labels = report.missingRecommendedFields.slice(0, 4).map((f) => f.label).join("、")
      const extra = report.missingRecommendedFields.length > 4 ? ` 等共 ${report.missingRecommendedFields.length} 项` : ""
      toast.info(`提示：该模板建议补充${labels}${extra}，仍可继续构建`)
    }

    setBuilding(true)
    try {
      const body: Record<string, unknown> = { resumeJson }
      if (selectedTheme) body.selectedTheme = selectedTheme
      const res = await fetch("/api/resume/json/build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        cache: "no-store",
      })
      const data = await res.json().catch(() => ({}))
      if (!data.ok) {
        toast.error(data.error || "构建失败")
        return
      }
      removeUserStorage("local", draftKey)
      if (data.fallback) {
        toast.warning(`当前模板不可用，已使用 ${data.usedTheme} 构建`)
      } else {
        toast.success("构建成功")
      }
      router.push("/resume")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "构建失败")
    } finally { setBuilding(false) }
  }

  function copyMarkdown() {
    void copyTextWithToast(initialContent, "已复制到剪贴板", "复制失败，请手动复制")
  }

  const showOldMarkdown = initialMode === "markdown" && initialContent

  return (
    <div className="mx-auto w-full max-w-[1600px] px-6 py-10 lg:px-10">
      {/* Top bar */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <Link href="/resume" className="inline-flex items-center gap-1 text-sm text-[--color-text-muted] hover:text-[--color-text-primary] hover:no-underline">
          <ArrowLeft size={14} /> 返回简历
        </Link>
        <div className="flex items-center gap-3">
          <div className="flex overflow-hidden rounded-[--radius-sm] border border-[--color-border] text-xs">
            <button
              onClick={() => setTab("pdf")}
              className={`px-3 py-1.5 transition-colors ${tab === "pdf" ? "bg-[--color-text-primary] text-white" : "text-[--color-text-secondary] hover:bg-[--color-bg-hover]"}`}
            >
              PDF 简历
            </button>
            <button
              onClick={() => setTab("online")}
              className={`px-3 py-1.5 transition-colors ${tab === "online" ? "bg-[--color-text-primary] text-white" : "text-[--color-text-secondary] hover:bg-[--color-bg-hover]"}`}
            >
              在线简历
            </button>
          </div>
          {tab === "pdf" && pdfPath && (
            <Button size="sm" onClick={handleSavePdfMode} disabled={savingDraft}>
              {savingDraft ? "保存中..." : "应用 PDF 模式"}
            </Button>
          )}
        </div>
      </div>

      {/* ── PDF Tab ── */}
      {tab === "pdf" && (
        <div className="space-y-5">
          {pdfPath ? (
            <div>
              <Label className="mb-2 block text-xs">当前简历版本</Label>
              <iframe
                src={pdfPath}
                className="h-[1200px] min-h-[calc(var(--app-viewport-height)-12rem)] w-full rounded border border-[--color-border]"
                title="简历 PDF"
              />
            </div>
          ) : (
            <p className="text-sm text-[--color-text-muted]">还没有上传 PDF，请先上传一个版本。</p>
          )}

          <div className="rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface] p-4">
            <Label className="mb-2 block text-xs">上传新版本</Label>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Input
                value={versionName}
                onChange={(event) => setVersionName(event.target.value)}
                placeholder="版本名，例如：春招版、中文完整版"
                className="h-9 text-sm"
              />
              <input
                ref={fileRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) void handlePdfUpload(file)
                }}
              />
              <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading} className="h-9 gap-1.5 whitespace-nowrap">
                <Upload size={13} /> {uploading ? "上传中..." : "选择 PDF 文件"}
              </Button>
            </div>
            <p className="mt-2 text-xs text-[--color-text-muted]">上传会创建一个新版本并自动设为展示版本，旧版本会保留在下面。</p>
          </div>

          <div className="rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface]">
            <div className="border-b border-[--color-border] px-4 py-3">
              <h2 className="text-sm font-semibold">简历版本</h2>
            </div>
            {versions.length === 0 ? (
              <p className="p-4 text-sm text-[--color-text-muted]">暂无简历版本</p>
            ) : (
              <div className="divide-y divide-[--color-border]">
                {versions.map((version) => {
                  const isCurrent = version.pdfPath === pdfPath
                  return (
                    <div key={version.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                      <FileText size={16} className="shrink-0 text-[--color-text-muted]" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{version.name} {isCurrent && <span className="text-xs text-[--color-link]">当前展示</span>}</p>
                        <p className="truncate font-mono text-xs text-[--color-text-muted]">{version.originalName} · {formatChinaDateTime(version.createdAt)}</p>
                      </div>
                      {!isCurrent && (
                        <Button size="sm" variant="outline" onClick={() => setCurrentVersion(version)}>设为展示</Button>
                      )}
                      <Button asChild size="sm" variant="outline">
                        <a href={version.pdfPath} download={version.originalName || version.name} className="gap-1.5">
                          <Download size={14} /> 下载
                        </a>
                      </Button>
                      <button
                        onClick={() => deleteVersion(version)}
                        className="p-1 text-[--color-text-muted] hover:text-[--color-danger]"
                        title="删除版本"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Online Resume Tab ── */}
      {tab === "online" && (
        <div className="space-y-4">
          {/* Toolbar: theme select + template center link */}
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={selectedTheme ?? ""}
              onChange={(e) => {
                const newTheme = e.target.value || null
                setSelectedTheme(newTheme)
                if (newTheme !== selectedTheme) {
                  toast.info("切换模板后，需要重新构建才能看到效果")
                }
              }}
              className="h-9 rounded-[--radius-sm] border border-[--color-border] bg-[--color-bg-surface] text-[--color-text-primary] px-3 text-xs"
            >
              <option value="">默认主题</option>
              {availableThemes.map((t) => (
                <option key={t.slug} value={t.slug}>{t.label}</option>
              ))}
            </select>
            <Link href="/resume/templates" className="inline-flex items-center gap-1 text-xs text-[--color-text-muted] hover:text-[--color-text-primary] hover:no-underline">
              <LayoutTemplate size={12} /> 前往模板中心
            </Link>
          </div>

          {/* Readiness banner */}
          <div className="mx-auto max-w-[1000px]">
            <TemplateReadinessBanner
              formState={formState}
              themeSlug={selectedTheme}
              themeLabel={availableThemes.find((t) => t.slug === selectedTheme)?.label ?? (selectedTheme ? selectedTheme : "默认主题")}
            />
          </div>

          {/* Output options */}
          <div className="mx-auto max-w-[1000px]">
            <OutputOptions
              value={outputOptions}
              onChange={setOutputOptions}
              capabilities={capabilities}
              onOpenSectionManager={() => setShowSectionManager(true)}
              onOpenFieldLabelEditor={() => setShowFieldLabelEditor(true)}
            />
          </div>

          {/* Form */}
          <div className="mx-auto max-w-[1000px]">
            <ResumeForm
              value={formState}
              onChange={setFormState}
              sectionOrder={outputOptions.sectionOrder}
              hiddenSections={outputOptions.hiddenSections}
              fieldLabelMap={outputOptions.fieldLabelMap}
            />
          </div>

          {/* Old Markdown collapsible */}
          {showOldMarkdown && (
            <details className="mx-auto max-w-[1000px] rounded-[--radius-md] border border-[--color-border] bg-[--color-bg-surface] overflow-hidden">
              <summary className="px-4 py-3 text-sm font-medium cursor-pointer select-none">
                查看旧版 Markdown 内容（仅供参考）
              </summary>
              <div className="px-4 pb-4">
                <pre className="whitespace-pre-wrap text-xs font-mono text-[--color-text-secondary] max-h-64 overflow-y-auto bg-[--color-bg-hover] rounded p-3">
                  {initialContent}
                </pre>
                <Button variant="outline" size="sm" onClick={copyMarkdown} className="mt-2 gap-1 text-xs">
                  <Copy size={12} /> 复制到剪贴板
                </Button>
              </div>
            </details>
          )}

          {/* Bottom action bar */}
          <FormActionsBar
            savingDraft={savingDraft}
            building={building}
            statusText={building ? "正在构建预览和在线简历..." : savingDraft ? "正在保存简历变更..." : undefined}
            onSaveDraft={handleSaveDraft}
            onBuild={handleBuild}
            onBack={() => router.push("/resume")}
          />

          {showSectionManager && (
            <SectionManager
              sectionOrder={outputOptions.sectionOrder}
              hiddenSections={outputOptions.hiddenSections}
              onChange={(order, hidden) => setOutputOptions((prev) => ({ ...prev, sectionOrder: order, hiddenSections: hidden }))}
              onClose={() => setShowSectionManager(false)}
              sectionOrderSupport={capabilities?.sectionOrderSupport}
            />
          )}

          {showFieldLabelEditor && (
            <FieldLabelMapEditor
              value={outputOptions.fieldLabelMap}
              onChange={(map) => setOutputOptions((prev) => ({ ...prev, fieldLabelMap: map }))}
              onClose={() => setShowFieldLabelEditor(false)}
            />
          )}
        </div>
      )}
    </div>
  )
}
