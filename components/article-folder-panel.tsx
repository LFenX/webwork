"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Folder, Pencil, Plus } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { confirmAction } from "@/lib/interaction-feedback"
import type { ArticleFolderItem } from "@/lib/mdx"

type ArticleFolderPanelProps = {
  type: "blog" | "daily" | "reflections" | "notes"
  basePath: string
  folders: ArticleFolderItem[]
  selectedFolder?: string
  readOnly?: boolean
}

const EMPTY_FORM = {
  name: "",
  description: "",
  coverImageUrl: "",
  coverPositionX: 50,
  coverPositionY: 50,
  coverOpacity: 100,
  coverFitMode: "auto",
  coverScale: 100,
}

type FolderForm = typeof EMPTY_FORM
type CoverStyleInput = Pick<
  ArticleFolderItem | FolderForm,
  "coverImageUrl" | "coverPositionX" | "coverPositionY" | "coverOpacity" | "coverFitMode" | "coverScale"
>

function coverStyle(folder: CoverStyleInput) {
  const auto = folder.coverFitMode !== "manual"
  return {
    backgroundImage: `url(${folder.coverImageUrl})`,
    backgroundPosition: auto ? "50% 50%" : `${folder.coverPositionX}% ${folder.coverPositionY}%`,
    backgroundSize: auto ? "cover" : `${folder.coverScale}% auto`,
    backgroundRepeat: "no-repeat",
    opacity: folder.coverOpacity / 100,
  }
}

export function ArticleFolderPanel({ type, basePath, folders, selectedFolder, readOnly = false }: ArticleFolderPanelProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<ArticleFolderItem | null>(null)
  const [form, setForm] = useState<FolderForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [uploadingCover, setUploadingCover] = useState(false)
  const [dragOverFolder, setDragOverFolder] = useState<string | null>(null)

  useEffect(() => {
    if (readOnly) return
    function handleDragStart(event: DragEvent) {
      const target = event.target instanceof Element ? event.target.closest("[data-post-id]") : null
      const postId = target?.getAttribute("data-post-id")
      if (!postId) return
      window.sessionStorage.setItem("dragging-post-id", postId)
      event.dataTransfer?.setData("text/plain", postId)
      if (event.dataTransfer) event.dataTransfer.effectAllowed = "move"
    }

    document.addEventListener("dragstart", handleDragStart)
    return () => document.removeEventListener("dragstart", handleDragStart)
  }, [readOnly])

  function startCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setOpen(true)
  }

  function startEdit(folder: ArticleFolderItem) {
    setEditing(folder)
    setForm({
      name: folder.name,
      description: folder.description,
      coverImageUrl: folder.coverImageUrl,
      coverPositionX: folder.coverPositionX,
      coverPositionY: folder.coverPositionY,
      coverOpacity: folder.coverOpacity,
      coverFitMode: folder.coverFitMode === "manual" ? "manual" : "auto",
      coverScale: folder.coverScale,
    })
    setOpen(true)
  }

  async function uploadCover(file: File) {
    setUploadingCover(true)
    try {
      const data = new FormData()
      data.append("file", file)
      const res = await fetch("/api/upload", { method: "POST", body: data })
      if (!res.ok) throw new Error()
      const json = await res.json() as { url?: string }
      if (!json.url) throw new Error()
      setForm((current) => ({
        ...current,
        coverImageUrl: json.url ?? "",
        coverPositionX: 50,
        coverPositionY: 50,
        coverOpacity: 100,
        coverFitMode: "auto",
        coverScale: 100,
      }))
      toast.success("背景图片已上传")
    } catch {
      toast.error("上传背景图片失败")
    } finally {
      setUploadingCover(false)
    }
  }

  async function moveDraggedPost(folderId: string | null) {
    if (readOnly) return
    const postId = window.sessionStorage.getItem("dragging-post-id")
    if (!postId) return
    setDragOverFolder(null)
    try {
      const res = await fetch(`/api/posts/${postId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderId }),
      })
      if (!res.ok) throw new Error()
      toast.success(folderId ? "文章已放入文件夹" : "文章已移到未分类")
      router.refresh()
    } catch {
      toast.error("移动文章失败")
    } finally {
      window.sessionStorage.removeItem("dragging-post-id")
    }
  }

  async function saveFolder() {
    if (!form.name.trim()) {
      toast.error("文件夹名称不能为空")
      return
    }

    setSaving(true)
    try {
      const res = await fetch(editing ? `/api/article-folders/${editing.id}` : "/api/article-folders", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, ...form }),
      })
      if (!res.ok) throw new Error()
      toast.success(editing ? "文件夹已更新" : "文件夹已创建")
      setOpen(false)
      router.refresh()
    } catch {
      toast.error("保存文件夹失败")
    } finally {
      setSaving(false)
    }
  }

  async function deleteFolder() {
    if (!editing) return
    if (!confirmAction(`确认删除文件夹“${editing.name}”？文章会回到未分类，文件夹设置和封面将被移除。`)) return

    setSaving(true)
    try {
      const res = await fetch(`/api/article-folders/${editing.id}`, { method: "DELETE" })
      if (!res.ok) throw new Error()
      toast.success("文件夹已删除")
      setOpen(false)
      router.push(basePath)
      router.refresh()
    } catch {
      toast.error("删除文件夹失败")
    } finally {
      setSaving(false)
    }
  }

  function folderCardClasses(active: boolean) {
    return `min-h-28 rounded-[--radius-lg] border transition-colors ${
      active
        ? "border-[--color-text-primary] bg-[--color-bg-surface] shadow-[0_8px_24px_rgba(15,23,42,.08)]"
        : "border-[--color-border] hover:border-[--color-border-strong]"
    }`
  }

  return (
    <section className="mb-8">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[--color-text-muted]">文件夹</h2>
        {!readOnly && (
          <button
            type="button"
            onClick={startCreate}
            className="inline-flex items-center gap-1 text-xs text-[--color-accent] hover:text-[--color-text-primary]"
          >
            <Plus size={12} /> 新建文件夹
          </button>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Link href={basePath} className={`${folderCardClasses(!selectedFolder)} hover:no-underline`}>
          <div className="p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-[--color-text-primary]">
              <Folder size={14} /> 全部文章
            </div>
            <p className="mt-2 text-xs text-[--color-text-muted]">查看当前模块的所有文章</p>
            {!selectedFolder && <p className="mt-3 text-xs text-[--color-accent]">当前筛选</p>}
          </div>
        </Link>

        <Link
          href={`${basePath}?folder=uncategorized`}
          onDragOver={(event) => {
            if (readOnly) return
            event.preventDefault()
            setDragOverFolder("uncategorized")
          }}
          onDragLeave={() => setDragOverFolder(null)}
          onDrop={(event) => {
            if (readOnly) return
            event.preventDefault()
            void moveDraggedPost(null)
          }}
          className={`${folderCardClasses(selectedFolder === "uncategorized")} ${dragOverFolder === "uncategorized" ? "border-[--color-accent] bg-[--color-bg-hover]" : ""} hover:no-underline`}
        >
          <div className="p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-[--color-text-primary]">
              <Folder size={14} /> 未分类
            </div>
            <p className="mt-2 text-xs text-[--color-text-muted]">尚未放入文件夹的文章</p>
            {selectedFolder === "uncategorized" && <p className="mt-3 text-xs text-[--color-accent]">当前筛选</p>}
          </div>
        </Link>

        {folders.map((folder) => (
          <article
            key={folder.id}
            onDragOver={(event) => {
              if (readOnly) return
              event.preventDefault()
              setDragOverFolder(folder.id)
            }}
            onDragLeave={() => setDragOverFolder(null)}
            onDrop={(event) => {
              if (readOnly) return
              event.preventDefault()
              void moveDraggedPost(folder.id)
            }}
            className={`${folderCardClasses(selectedFolder === folder.id)} ${dragOverFolder === folder.id ? "border-[--color-accent] bg-[--color-bg-hover]" : ""} overflow-hidden`}
          >
            <div className="grid min-h-28 grid-cols-[112px_minmax(0,1fr)]">
              <div className="border-r border-[--color-border] bg-[--color-bg-hover]">
                {folder.coverImageUrl ? (
                  <div className="h-full min-h-28 bg-[--color-bg-hover]" style={coverStyle(folder)} />
                ) : (
                  <div className="flex h-full min-h-28 items-center justify-center text-[--color-text-muted]">
                    <Folder size={28} />
                  </div>
                )}
              </div>
              <div className="flex min-h-28 flex-col p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="flex items-center gap-2 text-sm font-medium text-[--color-text-primary]">
                      <span className={`relative inline-block h-4 w-5 ${selectedFolder === folder.id ? "translate-y-0.5" : ""}`}>
                        <span className={`absolute left-0 top-1 h-3 w-5 rounded-sm border border-current transition-transform ${selectedFolder === folder.id ? "translate-y-1" : ""}`} />
                        <span className={`absolute left-0 top-0 h-2 w-5 origin-bottom rounded-t-sm border border-current bg-[--color-bg-surface] transition-transform ${selectedFolder === folder.id ? "-translate-y-0.5 -rotate-12" : ""}`} />
                      </span>
                      {folder.name}
                    </p>
                    <p className="mt-1 line-clamp-2 text-xs text-[--color-text-muted]">{folder.description || "暂无简介"}</p>
                  </div>
                  <span className="shrink-0 text-xs text-[--color-text-muted]">{folder.postCount} 篇</span>
                </div>

                <div className="mt-auto flex items-center justify-between pt-4">
                  {selectedFolder === folder.id ? (
                    <span className="text-xs text-[--color-accent]">文件夹已打开</span>
                  ) : (
                    <span className="text-xs text-[--color-text-muted]">{readOnly ? "查看该文件夹文章" : "拖文章到这里归档"}</span>
                  )}
                  <div className="flex items-center gap-2">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`${basePath}?folder=${folder.id}`}>打开</Link>
                    </Button>
                    {!readOnly && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => startEdit(folder)}>
                        <Pencil size={14} /> 编辑
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "编辑文件夹" : "新建文件夹"}</DialogTitle>
            <DialogDescription>
              设置文件夹名称、简介和背景图片。删除文件夹不会删除文章，文章会回到未分类。
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div>
              <Label className="mb-1 block text-xs">名称</Label>
              <Input value={form.name} onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))} />
            </div>
            <div>
              <Label className="mb-1 block text-xs">简介</Label>
              <Textarea value={form.description} onChange={(e) => setForm((current) => ({ ...current, description: e.target.value }))} />
            </div>
            <div>
              <Label className="mb-1 block text-xs">背景图片</Label>
              <Input
                type="file"
                accept="image/*"
                disabled={uploadingCover}
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) void uploadCover(file)
                }}
              />
              {form.coverImageUrl && (
                <div className="mt-3">
                  <p className="mb-1 text-xs text-[--color-text-muted]">卡片预览</p>
                  <div className="h-28 w-28 rounded-[--radius-sm] border border-[--color-border] bg-[--color-bg-hover]" style={coverStyle(form)} />
                </div>
              )}
            </div>
            {form.coverImageUrl && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <button
                    type="button"
                    onClick={() => setForm((current) => ({ ...current, coverFitMode: current.coverFitMode === "manual" ? "auto" : "manual" }))}
                    className={`inline-flex h-8 items-center rounded-[--radius-sm] border px-3 text-xs transition-colors ${
                      form.coverFitMode !== "manual"
                        ? "border-[#111827] bg-[#111827] text-white shadow-sm"
                        : "border-[#9ca3af] bg-white text-[#111827] hover:border-[#111827] hover:bg-[#f3f4f6]"
                    }`}
                  >
                    自适应
                  </button>
                  <span className="ml-2 text-xs text-[--color-text-muted]">
                    {form.coverFitMode !== "manual" ? "已启用，自动铺满文件夹封面" : "已关闭，可手动调整位置和缩放"}
                  </span>
                </div>
                {form.coverFitMode === "manual" && (
                  <>
                    <div>
                      <Label className="mb-1 block text-xs">横向范围</Label>
                      <Input
                        type="range"
                        min="0"
                        max="100"
                        value={form.coverPositionX}
                        onChange={(event) => setForm((current) => ({ ...current, coverPositionX: Number(event.target.value) }))}
                      />
                    </div>
                    <div>
                      <Label className="mb-1 block text-xs">纵向范围</Label>
                      <Input
                        type="range"
                        min="0"
                        max="100"
                        value={form.coverPositionY}
                        onChange={(event) => setForm((current) => ({ ...current, coverPositionY: Number(event.target.value) }))}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <Label className="mb-1 block text-xs">缩放</Label>
                      <Input
                        type="range"
                        min="40"
                        max="240"
                        value={form.coverScale}
                        onChange={(event) => setForm((current) => ({ ...current, coverScale: Number(event.target.value) }))}
                      />
                    </div>
                  </>
                )}
                <div className="sm:col-span-2">
                  <Label className="mb-1 block text-xs">透明度</Label>
                  <Input
                    type="range"
                    min="20"
                    max="100"
                    value={form.coverOpacity}
                    onChange={(event) => setForm((current) => ({ ...current, coverOpacity: Number(event.target.value) }))}
                  />
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            {editing && <Button type="button" variant="outline" onClick={deleteFolder} loading={saving} loadingText="删除中...">删除</Button>}
            <Button type="button" onClick={saveFolder} loading={saving} loadingText="保存中...">保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
