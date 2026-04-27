"use client"

import { useCallback, useRef, useState } from "react"
import { Upload, X, Plus } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ALLOWED_MIME, UPLOAD_ERROR_MESSAGES } from "@/lib/upload"
import type { FolderItem, WebsiteResource } from "./website-share-client"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  editingWebsite: WebsiteResource | null
  folders: FolderItem[]
  session: { userId: string; email: string } | null
  onSuccess: () => void
  onFolderCreated: () => void
}

function WebsiteFormInner({
  editingWebsite, folders, session, onSuccess, onFolderCreated, onOpenChange,
}: Omit<Props, "open">) {
  const isEditing = !!editingWebsite
  const [name, setName] = useState(editingWebsite?.name || "")
  const [url, setUrl] = useState(editingWebsite?.url || "")
  const [description, setDescription] = useState(editingWebsite?.description || "")
  const [screenshotUrl, setScreenshotUrl] = useState(editingWebsite?.screenshotUrl || "")
  const [screenshotPosX, setScreenshotPosX] = useState(editingWebsite?.screenshotPositionX ?? 50)
  const [screenshotPosY, setScreenshotPosY] = useState(editingWebsite?.screenshotPositionY ?? 50)
  const [screenshotScale, setScreenshotScale] = useState(editingWebsite?.screenshotScale ?? 100)
  const [screenshotFitMode, setScreenshotFitMode] = useState(editingWebsite?.screenshotFitMode || "cover")
  const [tags, setTags] = useState<string[]>(
    editingWebsite?.tags ? (Array.isArray(editingWebsite.tags) ? editingWebsite.tags : []) : []
  )
  const [tagInput, setTagInput] = useState("")
  const [folderId, setFolderId] = useState(editingWebsite?.folderId || "")
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [newFolderName, setNewFolderName] = useState("")
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [creatingFolder, setCreatingFolder] = useState(false)
  const [updatedFolders, setUpdatedFolders] = useState<FolderItem[] | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const displayFolders = updatedFolders ?? folders

  const handleUpload = useCallback(async (file: File) => {
    if (!ALLOWED_MIME.has(file.type)) {
      toast.error(UPLOAD_ERROR_MESSAGES.invalid_mime)
      return
    }
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const res = await fetch("/api/upload", { method: "POST", body: fd })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error(UPLOAD_ERROR_MESSAGES[err.error as string] ?? "上传失败")
        return
      }
      const { url: uploadedUrl } = await res.json()
      setScreenshotUrl(uploadedUrl)
      toast.success("截图已上传")
    } finally {
      setUploading(false)
    }
  }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleUpload(file)
  }

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const file = e.clipboardData.files?.[0]
    if (file && file.type.startsWith("image/")) {
      e.preventDefault()
      handleUpload(file)
    }
  }, [handleUpload])

  const addTag = () => {
    const t = tagInput.trim()
    if (!t) return
    if (tags.includes(t)) { setTagInput(""); return }
    if (tags.length >= 10) { toast.error("最多 10 个标签"); return }
    if (t.length > 30) { toast.error("标签最多 30 个字符"); return }
    setTags([...tags, t])
    setTagInput("")
  }

  const removeTag = (t: string) => setTags(tags.filter((tag) => tag !== t))

  const handleCreateFolder = async () => {
    const n = newFolderName.trim()
    if (!n) return
    setCreatingFolder(true)
    try {
      const res = await fetch("/api/website-folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: n }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error ?? "创建文件夹失败")
        return
      }
      const created = await res.json()
      toast.success("文件夹已创建")
      setNewFolderName("")
      setShowNewFolder(false)
      // Auto-select the newly created folder
      if (created?.id) {
        setFolderId(created.id)
      }
      // Optimistically add to local folder list
      if (created?.id) {
        setUpdatedFolders([...folders, { id: created.id, name: n, userId: session?.userId || "", _count: { websites: 0 } }])
      }
      onFolderCreated()
    } finally {
      setCreatingFolder(false)
    }
  }

  const handleSubmit = async () => {
    const newErrors: Record<string, string> = {}
    if (!name.trim()) newErrors.name = "请输入网站名称"
    if (!url.trim()) {
      newErrors.url = "请输入网站链接"
    } else {
      try {
        const u = new URL(url.trim())
        if (u.protocol !== "http:" && u.protocol !== "https:") {
          newErrors.url = "仅支持 http/https 链接"
        }
      } catch { newErrors.url = "请输入有效的链接" }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    setSubmitting(true)
    const body = {
      name: name.trim(),
      url: url.trim(),
      description: description.trim(),
      screenshotUrl: screenshotUrl || null,
      screenshotPositionX: screenshotPosX,
      screenshotPositionY: screenshotPosY,
      screenshotScale,
      screenshotFitMode,
      tags,
      folderId: folderId || null,
    }

    const method = isEditing ? "PATCH" : "POST"
    const endpoint = isEditing ? `/api/websites/${editingWebsite!.id}` : "/api/websites"

    try {
      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error ?? "提交失败")
        return
      }
      toast.success(isEditing ? "资源已更新" : "资源已发布")
      onSuccess()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{isEditing ? "编辑网站资源" : "分享一个网站资源"}</DialogTitle>
      </DialogHeader>

      <div className="space-y-4" onPaste={handlePaste}>
        {/* Screenshot upload */}
        <div>
          <div
            className={`relative rounded-[--radius-md] border-2 border-dashed transition-colors cursor-pointer ${
              screenshotUrl
                ? "border-transparent"
                : "border-[--color-border-strong] hover:border-[--color-text-muted]"
            }`}
            onClick={() => fileInputRef.current?.click()}
          >
            {screenshotUrl ? (
              <div className="relative aspect-[16/9] rounded-[--radius-md] overflow-hidden">
                <img src={screenshotUrl} alt="截图预览" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setScreenshotUrl("") }}
                  className="absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70"
                >
                  <X size={12} />
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Upload size={28} className="mb-2 text-[--color-text-muted]" />
                <p className="text-sm text-[--color-text-secondary]">
                  {uploading ? "上传中..." : "点击上传网站截图"}
                </p>
                <p className="mt-1 text-xs text-[--color-text-muted]">PNG、JPEG、WebP，建议 16:9 比例，或直接粘贴图片</p>
              </div>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        {/* Screenshot controls */}
        {screenshotUrl && (
          <div className="rounded-[--radius-md] border border-[--color-border] bg-[--color-bg-soft] p-3 space-y-3">
            <p className="text-xs font-medium text-[--color-text-muted]">截图显示调整</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-[11px] text-[--color-text-muted]">水平位置: {screenshotPosX}%</label>
                <input type="range" min={0} max={100} value={screenshotPosX} onChange={(e) => setScreenshotPosX(Number(e.target.value))} className="w-full h-1.5 accent-[--color-brand]" />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-[--color-text-muted]">垂直位置: {screenshotPosY}%</label>
                <input type="range" min={0} max={100} value={screenshotPosY} onChange={(e) => setScreenshotPosY(Number(e.target.value))} className="w-full h-1.5 accent-[--color-brand]" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-[11px] text-[--color-text-muted]">缩放: {screenshotScale}%</label>
                <input type="range" min={40} max={240} value={screenshotScale} onChange={(e) => setScreenshotScale(Number(e.target.value))} className="w-full h-1.5 accent-[--color-brand]" />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-[--color-text-muted]">适配方式</label>
                <select value={screenshotFitMode} onChange={(e) => setScreenshotFitMode(e.target.value)} className="h-8 w-full rounded-[--radius-sm] border border-[--color-border-strong] bg-[--color-bg-surface] px-2 text-xs text-[--color-text-primary] outline-none">
                  <option value="cover">填充 (cover)</option>
                  <option value="contain">完整显示 (contain)</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Name */}
        <div>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="网站名称 *"
            className={errors.name ? "border-[--color-danger]" : ""}
          />
          {errors.name && <p className="mt-1 text-xs text-[--color-danger]">{errors.name}</p>}
        </div>

        {/* URL */}
        <div>
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="网站链接 * https://example.com"
            className={errors.url ? "border-[--color-danger]" : ""}
          />
          {errors.url && <p className="mt-1 text-xs text-[--color-danger]">{errors.url}</p>}
        </div>

        {/* Description */}
        <div>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="简单介绍一下这个网站...（最多 500 字）"
            rows={3}
            maxLength={500}
          />
        </div>

        {/* Tags */}
        <div>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {tags.map((t) => (
              <span key={t} className="inline-flex items-center gap-1 rounded-full bg-[--color-brand-soft] px-2.5 py-1 text-xs text-[--color-brand]">
                {t}
                <button type="button" onClick={() => removeTag(t)} className="hover:text-[--color-text-primary]">
                  <X size={11} />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag() } }}
              placeholder="输入标签，回车添加（最多 10 个）"
              className="flex-1"
            />
            <Button type="button" variant="outline" size="sm" onClick={addTag}>添加</Button>
          </div>
        </div>

        {/* Folder */}
        <div>
          {!showNewFolder ? (
            <div className="flex items-center gap-2">
              <select
                value={folderId}
                onChange={(e) => setFolderId(e.target.value)}
                className="h-10 flex-1 rounded-[--radius-sm] border border-[--color-border-strong] bg-[--color-bg-surface] px-3 text-sm text-[--color-text-primary] outline-none"
              >
                <option value="">选择文件夹（可选）</option>
                {displayFolders.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
              <Button type="button" variant="outline" size="sm" onClick={() => setShowNewFolder(true)} className="gap-1 shrink-0">
                <Plus size={14} />
                新建
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Input
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="新文件夹名称"
                className="flex-1"
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleCreateFolder() } }}
                autoFocus
              />
              <Button type="button" variant="outline" size="sm" onClick={handleCreateFolder} disabled={creatingFolder}>
                {creatingFolder ? "创建中" : "确定"}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => { setShowNewFolder(false); setNewFolderName("") }}>
                取消
              </Button>
            </div>
          )}
        </div>

        {/* Submit */}
        <div className="flex gap-2 pt-2">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button className="flex-1" onClick={handleSubmit} disabled={submitting}>
            {submitting ? "提交中..." : isEditing ? "保存修改" : "发布资源"}
          </Button>
        </div>
      </div>
    </DialogContent>
  )
}

export function WebsiteFormDialog({
  open, onOpenChange, editingWebsite, folders, session, onSuccess, onFolderCreated,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <WebsiteFormInner
        key={editingWebsite?.id ?? "__new__"}
        editingWebsite={editingWebsite}
        folders={folders}
        session={session}
        onSuccess={onSuccess}
        onFolderCreated={onFolderCreated}
        onOpenChange={onOpenChange}
      />
    </Dialog>
  )
}
