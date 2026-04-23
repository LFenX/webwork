"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ArrowLeft, Download, Eye, FileText, Trash2, Upload } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { MarkdownEditor } from "@/components/markdown-editor"
import { MarkdownContent } from "@/components/markdown-content"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { readUserStorage, removeUserStorage, userStorageKey, writeUserStorage } from "@/lib/client-storage"
import { formatChinaDateTime } from "@/lib/time"

interface ResumeEditorClientProps {
  userId: string
  initialContent: string
  initialMode: string
  initialPdfPath: string | null
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

export function ResumeEditorClient({ userId, initialContent, initialMode, initialPdfPath }: ResumeEditorClientProps) {
  const router = useRouter()
  const [mode, setMode] = useState<"markdown" | "pdf">(initialMode as "markdown" | "pdf")
  const [content, setContent] = useState(initialContent)
  const [pdfPath, setPdfPath] = useState(initialPdfPath)
  const [versions, setVersions] = useState<ResumeVersion[]>([])
  const [versionName, setVersionName] = useState("")
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const draftKey = userStorageKey(userId, "resume-draft", "markdown")
  const draftReady = useRef(false)

  useEffect(() => {
    fetch("/api/resume/versions", { cache: "no-store" })
      .then((res) => res.ok ? res.json() : [])
      .then((items: ResumeVersion[]) => setVersions(items))
      .catch(() => setVersions([]))
  }, [])

  useEffect(() => {
    const draft = readUserStorage<{ content: string }>({
      kind: "local",
      key: draftKey,
      userId,
      ttlMs: DRAFT_TTL_MS,
    })
    if (draft?.content && draft.content !== initialContent) {
      if (window.confirm("Restore the unsaved local resume draft?")) {
        window.setTimeout(() => {
          setContent(draft.content)
          toast.success("Local resume draft restored")
        }, 0)
      }
    }
    draftReady.current = true
  }, [draftKey, initialContent, userId])

  useEffect(() => {
    if (!draftReady.current || mode !== "markdown") return
    if (content === initialContent) {
      removeUserStorage("local", draftKey)
      return
    }
    writeUserStorage({ kind: "local", key: draftKey, userId, value: { content } })
  }, [content, draftKey, initialContent, mode, userId])

  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (!draftReady.current) return
      const draft = readUserStorage<{ content: string }>({ kind: "local", key: draftKey, userId, ttlMs: DRAFT_TTL_MS })
      if (!draft) return
      event.preventDefault()
      event.returnValue = ""
    }

    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => window.removeEventListener("beforeunload", handleBeforeUnload)
  }, [draftKey, userId])

  async function handleSaveMarkdown() {
    setSaving(true)
    try {
      const res = await fetch("/api/resume", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "markdown", content }),
        cache: "no-store",
      })
      if (!res.ok) throw new Error()
      removeUserStorage("local", draftKey)
      toast.success("简历已保存")
      router.push("/resume")
    } catch {
      toast.error("保存失败")
    } finally {
      setSaving(false)
    }
  }

  async function handlePdfUpload(file: File) {
    const name = versionName.trim()
    if (!name) {
      toast.error("请先填写版本名")
      return
    }
    setUploading(true)
    try {
      const form = new FormData()
      form.append("file", file)
      form.append("name", name)
      const res = await fetch("/api/resume/upload", { method: "POST", body: form, cache: "no-store" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "上传失败")
      setPdfPath(data.version.pdfPath)
      setMode("pdf")
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
    setSaving(true)
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
    } finally {
      setSaving(false)
    }
  }

  async function setCurrentVersion(version: ResumeVersion) {
    const res = await fetch(`/api/resume/versions/${version.id}`, { method: "PATCH", cache: "no-store" })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      toast.error(data.error || "切换失败")
      return
    }
    setPdfPath(version.pdfPath)
    setMode("pdf")
    toast.success("已设为展示版本")
  }

  async function deleteVersion(version: ResumeVersion) {
    if (!confirm(`确认删除版本「${version.name}」？`)) return
    const res = await fetch(`/api/resume/versions/${version.id}`, { method: "DELETE", cache: "no-store" })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      toast.error(data.error || "删除失败")
      return
    }
    setVersions((current) => current.filter((item) => item.id !== version.id))
    toast.success("版本已删除")
  }

  return (
    <div className="mx-auto max-w-[960px] px-6 py-10">
      <div className="mb-6 flex items-center justify-between gap-4">
        <Link href="/resume" className="inline-flex items-center gap-1 text-sm text-[--color-text-muted] hover:text-[--color-text-primary] hover:no-underline">
          <ArrowLeft size={14} /> 返回简历
        </Link>
        <div className="flex items-center gap-3">
          <div className="flex overflow-hidden rounded-[--radius-sm] border border-[--color-border] text-xs">
            <button
              onClick={() => setMode("markdown")}
              className={`px-3 py-1.5 transition-colors ${mode === "markdown" ? "bg-[--color-text-primary] text-white" : "text-[--color-text-secondary] hover:bg-[--color-bg-hover]"}`}
            >
              Markdown
            </button>
            <button
              onClick={() => setMode("pdf")}
              className={`px-3 py-1.5 transition-colors ${mode === "pdf" ? "bg-[--color-text-primary] text-white" : "text-[--color-text-secondary] hover:bg-[--color-bg-hover]"}`}
            >
              PDF
            </button>
          </div>
          {mode === "markdown" && (
            <>
              <Button variant="outline" size="sm" onClick={() => setPreviewOpen(true)} className="gap-1.5">
                <Eye size={14} /> 预览
              </Button>
              <Button size="sm" onClick={handleSaveMarkdown} disabled={saving}>
                {saving ? "保存中..." : "保存"}
              </Button>
            </>
          )}
          {mode === "pdf" && pdfPath && (
            <Button size="sm" onClick={handleSavePdfMode} disabled={saving}>
              {saving ? "保存中..." : "应用 PDF 模式"}
            </Button>
          )}
        </div>
      </div>

      {mode === "markdown" ? (
        <div>
          <Label className="mb-2 block text-xs">简历内容（Markdown）</Label>
          <MarkdownEditor value={content} onChange={setContent} height={600} />
        </div>
      ) : (
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

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>简历预览</DialogTitle>
          </DialogHeader>
          <div className="prose mt-2">
            <MarkdownContent source={content} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
