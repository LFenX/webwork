"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ArrowLeft, Upload } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { MarkdownEditor } from "@/components/markdown-editor"

interface ResumeEditorClientProps {
  initialContent: string
  initialMode: string
  initialPdfPath: string | null
}

export function ResumeEditorClient({ initialContent, initialMode, initialPdfPath }: ResumeEditorClientProps) {
  const router = useRouter()
  const [mode, setMode] = useState<"markdown" | "pdf">(initialMode as "markdown" | "pdf")
  const [content, setContent] = useState(initialContent)
  const [pdfPath, setPdfPath] = useState(initialPdfPath)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

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
      toast.success("简历已保存")
      router.push("/resume")
      router.refresh()
    } catch {
      toast.error("保存失败")
    } finally {
      setSaving(false)
    }
  }

  async function handlePdfUpload(file: File) {
    setUploading(true)
    try {
      const form = new FormData()
      form.append("file", file)
      const res = await fetch("/api/resume/upload", { method: "POST", body: form, cache: "no-store" })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setPdfPath(data.pdfPath)
      setMode("pdf")
      toast.success("PDF 已上传")
      router.refresh()
    } catch {
      toast.error("上传失败")
    } finally {
      setUploading(false)
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
      if (!res.ok) throw new Error()
      toast.success("已切换至 PDF 展示模式")
      router.push("/resume")
      router.refresh()
    } catch {
      toast.error("保存失败")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-[960px] mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-6">
        <Link href="/resume" className="inline-flex items-center gap-1 text-sm text-[--color-text-muted] hover:text-[--color-text-primary] hover:no-underline">
          <ArrowLeft size={14} /> 返回简历
        </Link>
        <div className="flex items-center gap-3">
          <div className="flex rounded-[--radius-sm] border border-[--color-border] overflow-hidden text-xs">
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
            <Button size="sm" onClick={handleSaveMarkdown} disabled={saving}>
              {saving ? "保存中..." : "保存"}
            </Button>
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
          <Label className="text-xs mb-2 block">简历内容（Markdown）</Label>
          <MarkdownEditor value={content} onChange={setContent} height={600} />
        </div>
      ) : (
        <div className="space-y-4">
          {pdfPath ? (
            <div>
              <Label className="text-xs mb-2 block">当前 PDF</Label>
              <iframe
                src={pdfPath}
                className="w-full border border-[--color-border] rounded"
                style={{ height: "60vh" }}
                title="简历 PDF"
              />
            </div>
          ) : (
            <p className="text-sm text-[--color-text-muted]">还没有上传 PDF，请先上传。</p>
          )}
          <div>
            <Label className="text-xs mb-2 block">{pdfPath ? "更新 PDF" : "上传 PDF"}</Label>
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) handlePdfUpload(f)
              }}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="gap-1.5"
            >
              <Upload size={13} /> {uploading ? "上传中..." : "选择 PDF 文件"}
            </Button>
            <p className="text-xs text-[--color-text-muted] mt-2">上传后自动覆盖当前 PDF，在简历页以 iframe 展示。</p>
          </div>
        </div>
      )}
    </div>
  )
}
