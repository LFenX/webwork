"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Folder, Pencil, Plus, UploadCloud } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { confirmAction } from "@/lib/interaction-feedback"
import { cn } from "@/lib/utils"
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

function folderCardClasses(active: boolean, dragOver = false) {
  return cn(
    "group min-h-32 overflow-hidden rounded-[18px] border bg-white/86 shadow-[0_10px_26px_rgba(15,23,42,0.045)] transition-all hover:-translate-y-0.5 hover:border-blue-200 hover:bg-white hover:shadow-[0_16px_36px_rgba(15,23,42,0.07)]",
    active ? "border-blue-300 bg-blue-50/60 ring-1 ring-blue-100" : "border-slate-200/80",
    dragOver && "border-blue-400 bg-blue-50 ring-2 ring-blue-100"
  )
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
      toast.success("封面图片已上传")
    } catch {
      toast.error("上传封面失败")
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
    if (!confirmAction(`确认删除文件夹「${editing.name}」？文章会回到未分类，文件夹设置和封面将被移除。`)) return

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

  return (
    <section className="min-w-0">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <Link href={basePath} className={cn(folderCardClasses(!selectedFolder), "hover:no-underline")}>
          <div className="flex h-full flex-col p-4">
            <span className="mb-4 flex size-11 items-center justify-center rounded-[14px] bg-blue-50 text-blue-600">
              <Folder size={21} />
            </span>
            <p className="text-sm font-bold text-slate-950">全部文章</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">查看当前模块的所有内容。</p>
            {!selectedFolder && <span className="mt-auto pt-4 text-xs font-semibold text-blue-600">当前筛选</span>}
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
          className={cn(folderCardClasses(selectedFolder === "uncategorized", dragOverFolder === "uncategorized"), "hover:no-underline")}
        >
          <div className="flex h-full flex-col p-4">
            <span className="mb-4 flex size-11 items-center justify-center rounded-[14px] bg-slate-100 text-slate-500">
              <Folder size={21} />
            </span>
            <p className="text-sm font-bold text-slate-950">未分类</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">尚未放入文件夹的内容会集中在这里。</p>
            {selectedFolder === "uncategorized" && <span className="mt-auto pt-4 text-xs font-semibold text-blue-600">当前筛选</span>}
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
            className={folderCardClasses(selectedFolder === folder.id, dragOverFolder === folder.id)}
          >
            <div className="grid h-full min-h-36 grid-cols-[112px_minmax(0,1fr)]">
              <div className="border-r border-slate-100 bg-gradient-to-br from-blue-50 to-slate-100">
                {folder.coverImageUrl ? (
                  <div className="h-full min-h-36 bg-slate-100" style={coverStyle(folder)} />
                ) : (
                  <div className="flex h-full min-h-36 items-center justify-center text-slate-400">
                    <Folder size={30} />
                  </div>
                )}
              </div>
              <div className="flex min-w-0 flex-col p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-950">{folder.name}</p>
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{folder.description || "暂无简介"}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">{folder.postCount} 篇</span>
                </div>

                <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-4">
                  <span className="text-xs text-slate-400">
                    {selectedFolder === folder.id ? "文件夹已打开" : readOnly ? "查看文件夹内容" : "拖拽文章到这里归档"}
                  </span>
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

      {!readOnly && (
        <div className="mt-4">
          <Button type="button" variant="outline" size="sm" onClick={startCreate}>
            <Plus size={14} /> 新建文件夹
          </Button>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing ? "编辑文件夹" : "新建文件夹"}</DialogTitle>
            <DialogDescription>
              设置文件夹名称、简介和封面。删除文件夹不会删除文章，文章会回到未分类。
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
              <Label className="mb-1 block text-xs">封面图片</Label>
              <label className="flex cursor-pointer flex-col items-center justify-center rounded-[18px] border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center transition-colors hover:border-blue-200 hover:bg-blue-50">
                <UploadCloud size={22} className="mb-2 text-blue-600" />
                <span className="text-sm font-medium text-slate-700">{uploadingCover ? "上传中..." : "选择图片作为封面"}</span>
                <span className="mt-1 text-xs text-slate-400">支持常见图片格式</span>
                <Input
                  type="file"
                  accept="image/*"
                  disabled={uploadingCover}
                  className="sr-only"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (file) void uploadCover(file)
                  }}
                />
              </label>
              {form.coverImageUrl && (
                <div className="mt-3">
                  <p className="mb-1 text-xs text-slate-500">卡片预览</p>
                  <div className="h-28 w-40 rounded-[16px] border border-slate-200 bg-slate-100" style={coverStyle(form)} />
                </div>
              )}
            </div>
            {form.coverImageUrl && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Button
                    type="button"
                    variant={form.coverFitMode !== "manual" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setForm((current) => ({ ...current, coverFitMode: current.coverFitMode === "manual" ? "auto" : "manual" }))}
                  >
                    自适应封面
                  </Button>
                  <span className="ml-2 text-xs text-slate-500">
                    {form.coverFitMode !== "manual" ? "已启用，自动铺满文件夹封面" : "已关闭，可手动调整位置和缩放"}
                  </span>
                </div>
                {form.coverFitMode === "manual" && (
                  <>
                    <div>
                      <Label className="mb-1 block text-xs">横向位置</Label>
                      <Input type="range" min="0" max="100" value={form.coverPositionX} onChange={(event) => setForm((current) => ({ ...current, coverPositionX: Number(event.target.value) }))} />
                    </div>
                    <div>
                      <Label className="mb-1 block text-xs">纵向位置</Label>
                      <Input type="range" min="0" max="100" value={form.coverPositionY} onChange={(event) => setForm((current) => ({ ...current, coverPositionY: Number(event.target.value) }))} />
                    </div>
                    <div className="sm:col-span-2">
                      <Label className="mb-1 block text-xs">缩放</Label>
                      <Input type="range" min="40" max="240" value={form.coverScale} onChange={(event) => setForm((current) => ({ ...current, coverScale: Number(event.target.value) }))} />
                    </div>
                  </>
                )}
                <div className="sm:col-span-2">
                  <Label className="mb-1 block text-xs">透明度</Label>
                  <Input type="range" min="20" max="100" value={form.coverOpacity} onChange={(event) => setForm((current) => ({ ...current, coverOpacity: Number(event.target.value) }))} />
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            {editing && (
              <Button type="button" variant="outline" onClick={deleteFolder} loading={saving} loadingText="删除中...">
                删除
              </Button>
            )}
            <Button type="button" onClick={saveFolder} loading={saving} loadingText="保存中...">
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
