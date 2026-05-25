"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Copy, Download, FileText, LayoutTemplate, Trash2, Upload } from "lucide-react"
import { toast } from "sonner"

import { FormActionsBar } from "@/components/resume-form/form-actions-bar"
import { FieldLabelMapEditor } from "@/components/resume-form/field-label-map-editor"
import { OutputOptions, type CapabilityInfo, type OutputOptionsValue } from "@/components/resume-form/output-options"
import { ResumeForm, DEFAULT_SECTION_ORDER } from "@/components/resume-form/resume-form"
import { SectionManager } from "@/components/resume-form/section-manager"
import { TemplateReadinessBanner } from "@/components/resume-form/template-readiness-banner"
import { ModuleHero, ModulePageShell, ModulePanel, modulePillClass } from "@/components/module/module-shell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { checkResumeBuildReadiness } from "@/lib/resume/build-readiness"
import { readUserStorage, removeUserStorage, userStorageKey, writeUserStorage } from "@/lib/client-storage"
import { confirmAction, copyTextWithToast } from "@/lib/interaction-feedback"
import { emptyFormState, type ResumeFormState } from "@/lib/resume/form-types"
import { formStateToResumeJson, resumeJsonToFormState } from "@/lib/resume/form-transform"
import type { ResumeThemeInfo } from "@/lib/resume/types"
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
      return emptyFormState()
    }
  }
  return emptyFormState()
}

export function ResumeEditorClient({
  userId,
  initialContent,
  initialMode,
  initialPdfPath,
  initialResumeJson,
  initialSelectedTheme,
  themes,
}: ResumeEditorClientProps) {
  const router = useRouter()
  const initialTab = initialMode === "pdf" ? "pdf" : "online"
  const [tab, setTab] = useState<"pdf" | "online">(initialTab)

  const [pdfPath, setPdfPath] = useState(initialPdfPath)
  const [versions, setVersions] = useState<ResumeVersion[]>([])
  const [versionName, setVersionName] = useState("")
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const [formState, setFormState] = useState<ResumeFormState>(() => buildInitialFormState(initialResumeJson))
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
  const draftReady = useRef(false)
  const saveDraftTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const availableThemes = themes.filter((theme) => theme.available)
  const draftKey = userStorageKey(userId, "resume-form-draft", "v1")
  const showOldMarkdown = initialMode === "markdown" && initialContent

  useEffect(() => {
    fetch("/api/resume/versions", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : []))
      .then((items: ResumeVersion[]) => setVersions(items))
      .catch(() => setVersions([]))
  }, [])

  useEffect(() => {
    const draft = readUserStorage<{ formState: ResumeFormState; selectedTheme: string | null }>({
      kind: "local",
      key: draftKey,
      userId,
      ttlMs: DRAFT_TTL_MS,
    })
    if (draft?.formState) {
      const initialForm = buildInitialFormState(initialResumeJson)
      if (JSON.stringify(draft.formState) !== JSON.stringify(initialForm)) {
        const shouldRestore = confirmAction(
          "Restore unsaved resume draft?",
          "Restoring will replace the current editor content with the local draft.",
        )
        if (shouldRestore) {
          window.setTimeout(() => {
            setFormState(draft.formState)
            if (draft.selectedTheme !== undefined) setSelectedTheme(draft.selectedTheme)
            toast.success("Local draft restored.")
          }, 0)
        }
      }
    }
    draftReady.current = true
  }, [draftKey, initialResumeJson, userId])

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
    return () => {
      if (saveDraftTimer.current) clearTimeout(saveDraftTimer.current)
    }
  }, [draftKey, formState, initialResumeJson, initialSelectedTheme, selectedTheme, tab, userId])

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

  useEffect(() => {
    fetch("/api/resume/config", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) {
          configLoadedRef.current = true
          return
        }
        const nested = (data.config?.fieldLabelMap ?? {}) as Record<string, Record<string, string>>
        const opts: OutputOptionsValue = {
          locale: data.locale ?? "auto",
          appearance: data.appearance ?? "system",
          sectionOrder: data.config?.sectionOrder ?? DEFAULT_SECTION_ORDER,
          hiddenSections: data.config?.hiddenSections ?? [],
          fieldLabelMap: {
            ...(nested.sections ?? {}),
            ...(nested.fields ?? {}),
            ...(nested.ui ?? {}),
          },
        }
        setOutputOptions(opts)
        loadedConfigJsonRef.current = JSON.stringify(opts)
        configLoadedRef.current = true
      })
      .catch(() => {
        configLoadedRef.current = true
      })
  }, [])

  useEffect(() => {
    const slug = selectedTheme ?? ""
    fetch(`/api/resume/effective-config?slug=${encodeURIComponent(slug)}`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setCapabilities(data?.capabilities ?? null))
      .catch(() => setCapabilities(null))
  }, [selectedTheme])

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
          if (!res.ok) throw new Error("Failed to save output options.")
          loadedConfigJsonRef.current = currentJson
        })
        .catch(() => toast.error("Failed to auto-save output options."))
    }, 800)
    return () => {
      if (saveConfigTimerRef.current) clearTimeout(saveConfigTimerRef.current)
    }
  }, [outputOptions])

  async function handlePdfUpload(file: File) {
    const name = versionName.trim()
    if (!name) {
      toast.error("Please enter a version name first.")
      return
    }
    setUploading(true)
    try {
      const form = new FormData()
      form.append("file", file)
      form.append("name", name)
      const res = await fetch("/api/resume/upload", { method: "POST", body: form, cache: "no-store" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Upload failed.")
      setPdfPath(data.version.pdfPath)
      setTab("pdf")
      setVersions((current) => [data.version, ...current])
      setVersionName("")
      toast.success("PDF version saved.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed.")
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
      if (!res.ok) throw new Error(data.error || "Save failed.")
      toast.success("PDF display mode applied.")
      router.push("/resume")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Save failed.")
    } finally {
      setSavingDraft(false)
    }
  }

  async function setCurrentVersion(version: ResumeVersion) {
    setSavingDraft(true)
    try {
      const res = await fetch(`/api/resume/versions/${version.id}`, { method: "PATCH", cache: "no-store" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error || "Failed to switch version.")
        return
      }
      setPdfPath(version.pdfPath)
      setTab("pdf")
      toast.success("Display version updated.")
    } finally {
      setSavingDraft(false)
    }
  }

  async function deleteVersion(version: ResumeVersion) {
    const ok = confirmAction(
      `Delete resume version "${version.name}"?`,
      "This PDF version will be removed from the version list.",
    )
    if (!ok) return
    setSavingDraft(true)
    try {
      const res = await fetch(`/api/resume/versions/${version.id}`, { method: "DELETE", cache: "no-store" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error || "Delete failed.")
        return
      }
      setVersions((current) => current.filter((item) => item.id !== version.id))
      toast.success("Version deleted.")
    } finally {
      setSavingDraft(false)
    }
  }

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
      if (!res.ok) throw new Error(data.error || data.issues?.join(", ") || "Failed to save draft.")
      removeUserStorage("local", draftKey)
      toast.success("Resume draft saved.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save draft.")
    } finally {
      setSavingDraft(false)
    }
  }

  async function handleBuild() {
    const resumeJson = formStateToResumeJson(formState)
    const report = checkResumeBuildReadiness(resumeJson, selectedTheme)

    if (!report.canBuild) {
      const msgs = report.missingRequiredFields.map((field) => field.errorMsg).join(" / ")
      toast.error(`Cannot build: ${msgs}`)
      return
    }

    if (report.missingRecommendedFields.length > 0) {
      const labels = report.missingRecommendedFields.slice(0, 4).map((field) => field.label).join(", ")
      const extra = report.missingRecommendedFields.length > 4 ? ` and ${report.missingRecommendedFields.length - 4} more` : ""
      toast.info(`Template suggestion: add ${labels}${extra} for a stronger resume.`)
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
        toast.error(data.error || "Build failed.")
        return
      }
      removeUserStorage("local", draftKey)
      if (data.fallback) toast.warning(`Selected template is unavailable. Built with ${data.usedTheme}.`)
      else toast.success("Resume built.")
      router.push("/resume")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Build failed.")
    } finally {
      setBuilding(false)
    }
  }

  function copyMarkdown() {
    void copyTextWithToast(initialContent, "Markdown copied.", "Copy failed. Please copy manually.")
  }

  return (
    <ModulePageShell maxWidth="full">
      <div className="space-y-5">
        <ModuleHero
          icon={FileText}
          title="Resume editor"
          description="Edit online resume details, manage PDF versions, tune template output, and build the public resume view."
          stats={[
            { label: "Current mode", value: tab === "online" ? "Online" : "PDF" },
            { label: "Templates", value: String(availableThemes.length) },
            { label: "PDF versions", value: String(versions.length) },
          ]}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Link href="/resume" className={modulePillClass(false)}>
                <ArrowLeft size={15} /> Back
              </Link>
              <div className="flex rounded-full border border-slate-200 bg-slate-100 p-1 text-sm">
                <button
                  type="button"
                  onClick={() => setTab("online")}
                  className={`rounded-full px-4 py-2 font-medium transition ${tab === "online" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-900"}`}
                >
                  Online
                </button>
                <button
                  type="button"
                  onClick={() => setTab("pdf")}
                  className={`rounded-full px-4 py-2 font-medium transition ${tab === "pdf" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-900"}`}
                >
                  PDF
                </button>
              </div>
              {tab === "pdf" && pdfPath ? (
                <Button onClick={handleSavePdfMode} disabled={savingDraft} className="h-10 rounded-full bg-blue-600 px-5 text-white hover:bg-blue-700">
                  {savingDraft ? "Saving..." : "Apply PDF mode"}
                </Button>
              ) : null}
            </div>
          }
        />

        {tab === "pdf" ? (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
            <ModulePanel title="PDF preview" description="Upload and choose the PDF version shown on your resume page." contentClassName="p-4">
              {pdfPath ? (
                <iframe
                  src={pdfPath}
                  className="h-[min(1200px,calc(var(--app-viewport-height)-15rem))] min-h-[620px] w-full rounded-[18px] border border-slate-200 bg-white"
                  title="Resume PDF"
                />
              ) : (
                <div className="rounded-[22px] border border-dashed border-blue-200 bg-blue-50/60 p-10 text-center text-sm text-slate-600">
                  No PDF has been uploaded yet.
                </div>
              )}
            </ModulePanel>

            <div className="space-y-5">
              <ModulePanel title="Upload version" description="Create a named PDF version and make it available for display." contentClassName="space-y-3 p-5">
                <Label className="text-xs font-semibold text-slate-500">Version name</Label>
                <Input
                  value={versionName}
                  onChange={(event) => setVersionName(event.target.value)}
                  placeholder="Spring application, CN full version..."
                  className="h-11 rounded-[14px]"
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
                <Button
                  variant="outline"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="h-11 w-full rounded-full border-blue-200 text-blue-600"
                >
                  <Upload size={15} /> {uploading ? "Uploading" : "Choose PDF"}
                </Button>
              </ModulePanel>

              <ModulePanel title="Version history" description="Switch, download, or remove existing versions." contentClassName="p-0">
                {versions.length === 0 ? (
                  <div className="p-6 text-sm text-slate-500">No versions yet.</div>
                ) : (
                  <div className="max-h-[520px] divide-y divide-slate-100 overflow-y-auto">
                    {versions.map((version) => {
                      const isCurrent = version.pdfPath === pdfPath
                      return (
                        <div key={version.id} className="flex items-center gap-3 p-4">
                          <FileText size={18} className="text-blue-500" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-slate-900">
                              {version.name} {isCurrent ? <span className="text-xs text-blue-600">Current</span> : null}
                            </p>
                            <p className="truncate text-xs text-slate-500">{version.originalName} / {formatChinaDateTime(version.createdAt)}</p>
                          </div>
                          {!isCurrent ? (
                            <Button size="sm" variant="outline" onClick={() => void setCurrentVersion(version)} className="rounded-full">
                              Use
                            </Button>
                          ) : null}
                          <Button asChild size="sm" variant="ghost" className="rounded-full">
                            <a href={version.pdfPath} download={version.originalName || version.name}>
                              <Download size={14} />
                            </a>
                          </Button>
                          <button
                            type="button"
                            onClick={() => void deleteVersion(version)}
                            className="rounded-full p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                            aria-label="Delete version"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </ModulePanel>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <ModulePanel contentClassName="p-5">
              <div className="flex flex-wrap items-center gap-3">
                <select
                  value={selectedTheme ?? ""}
                  onChange={(event) => {
                    const newTheme = event.target.value || null
                    setSelectedTheme(newTheme)
                    if (newTheme !== selectedTheme) toast.info("Rebuild the resume to preview the selected template.")
                  }}
                  className="h-11 rounded-full border border-slate-200 bg-white px-4 text-sm text-slate-700 shadow-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                >
                  <option value="">Default theme</option>
                  {availableThemes.map((theme) => (
                    <option key={theme.slug} value={theme.slug}>{theme.label}</option>
                  ))}
                </select>
                <Link href="/resume/templates" className={modulePillClass(false)}>
                  <LayoutTemplate size={15} /> Template center
                </Link>
              </div>
            </ModulePanel>

            <div className="mx-auto grid max-w-[1200px] gap-5">
              <TemplateReadinessBanner
                formState={formState}
                themeSlug={selectedTheme}
                themeLabel={availableThemes.find((theme) => theme.slug === selectedTheme)?.label ?? (selectedTheme ? selectedTheme : "Default theme")}
              />

              <OutputOptions
                value={outputOptions}
                onChange={setOutputOptions}
                capabilities={capabilities}
                onOpenSectionManager={() => setShowSectionManager(true)}
                onOpenFieldLabelEditor={() => setShowFieldLabelEditor(true)}
              />

              <ResumeForm
                value={formState}
                onChange={setFormState}
                sectionOrder={outputOptions.sectionOrder}
                hiddenSections={outputOptions.hiddenSections}
                fieldLabelMap={outputOptions.fieldLabelMap}
              />

              {showOldMarkdown ? (
                <details className="overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-sm">
                  <summary className="cursor-pointer select-none px-5 py-4 text-sm font-semibold text-slate-900">
                    Legacy Markdown content
                  </summary>
                  <div className="border-t border-slate-100 px-5 pb-5 pt-4">
                    <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded-[18px] bg-slate-50 p-4 font-mono text-xs text-slate-600">
                      {initialContent}
                    </pre>
                    <Button variant="outline" size="sm" onClick={copyMarkdown} className="mt-3 rounded-full">
                      <Copy size={13} /> Copy Markdown
                    </Button>
                  </div>
                </details>
              ) : null}
            </div>

            <FormActionsBar
              savingDraft={savingDraft}
              building={building}
              statusText={building ? "Building resume preview..." : savingDraft ? "Saving resume changes..." : undefined}
              onSaveDraft={handleSaveDraft}
              onBuild={handleBuild}
              onBack={() => router.push("/resume")}
            />

            {showSectionManager ? (
              <SectionManager
                sectionOrder={outputOptions.sectionOrder}
                hiddenSections={outputOptions.hiddenSections}
                onChange={(order, hidden) => setOutputOptions((prev) => ({ ...prev, sectionOrder: order, hiddenSections: hidden }))}
                onClose={() => setShowSectionManager(false)}
                sectionOrderSupport={capabilities?.sectionOrderSupport}
              />
            ) : null}

            {showFieldLabelEditor ? (
              <FieldLabelMapEditor
                value={outputOptions.fieldLabelMap}
                onChange={(map) => setOutputOptions((prev) => ({ ...prev, fieldLabelMap: map }))}
                onClose={() => setShowFieldLabelEditor(false)}
              />
            ) : null}
          </div>
        )}
      </div>
    </ModulePageShell>
  )
}
