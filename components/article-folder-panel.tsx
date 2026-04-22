"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Folder, Pencil, Plus } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { ArticleFolderItem } from "@/lib/mdx"

type ArticleFolderPanelProps = {
  type: "blog" | "daily" | "reflections" | "notes"
  basePath: string
  folders: ArticleFolderItem[]
  selectedFolder?: string
}

const EMPTY_FORM = { name: "", description: "", coverImageUrl: "" }

export function ArticleFolderPanel({ type, basePath, folders, selectedFolder }: ArticleFolderPanelProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<ArticleFolderItem | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

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
    })
    setOpen(true)
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
    if (!confirm(`确认删除文件夹「${editing.name}」？文章会移动到未分类。`)) return

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
    return `min-h-28 rounded-[--radius-lg] border p-4 transition-colors ${
      active
        ? "border-[--color-text-primary] bg-[--color-bg-surface]"
        : "border-[--color-border] hover:border-[--color-border-strong]"
    }`
  }

  return (
    <section className="mb-8">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[--color-text-muted]">文件夹</h2>
        <button
          type="button"
          onClick={startCreate}
          className="inline-flex items-center gap-1 text-xs text-[--color-accent] hover:text-[--color-text-primary]"
        >
          <Plus size={12} /> 新建文件夹
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Link href={basePath} className={`${folderCardClasses(!selectedFolder)} hover:no-underline`}>
          <div className="flex items-center gap-2 text-sm font-medium text-[--color-text-primary]">
            <Folder size={14} /> 全部文章
          </div>
          <p className="mt-2 text-xs text-[--color-text-muted]">查看当前模块的所有文章</p>
          {!selectedFolder && <p className="mt-3 text-xs text-[--color-accent]">当前筛选</p>}
        </Link>

        <Link href={`${basePath}?folder=uncategorized`} className={`${folderCardClasses(selectedFolder === "uncategorized")} hover:no-underline`}>
          <div className="flex items-center gap-2 text-sm font-medium text-[--color-text-primary]">
            <Folder size={14} /> 未分类
          </div>
          <p className="mt-2 text-xs text-[--color-text-muted]">尚未放入文件夹的文章</p>
          {selectedFolder === "uncategorized" && <p className="mt-3 text-xs text-[--color-accent]">当前筛选</p>}
        </Link>

        {folders.map((folder) => (
          <article
            key={folder.id}
            className={`${folderCardClasses(selectedFolder === folder.id)} overflow-hidden`}
            style={folder.coverImageUrl ? {
              backgroundImage: `linear-gradient(rgba(250,249,245,.84), rgba(250,249,245,.92)), url(${folder.coverImageUrl})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            } : undefined}
          >
            <div className="flex min-h-20 flex-col">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="flex items-center gap-2 text-sm font-medium text-[--color-text-primary]">
                    <Folder size={14} /> {folder.name}
                  </p>
                  <p className="mt-1 line-clamp-2 text-xs text-[--color-text-muted]">{folder.description || "暂无简介"}</p>
                </div>
                <span className="shrink-0 text-xs text-[--color-text-muted]">{folder.postCount} 篇</span>
              </div>

              <div className="mt-auto flex items-center justify-between pt-4">
                {selectedFolder === folder.id ? (
                  <span className="text-xs text-[--color-accent]">当前筛选</span>
                ) : (
                  <span className="text-xs text-[--color-text-muted]">点击打开查看文章</span>
                )}
                <div className="flex items-center gap-2">
                  <Button asChild variant="outline" size="sm">
                    <Link href={`${basePath}?folder=${folder.id}`}>打开</Link>
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => startEdit(folder)}>
                    <Pencil size={14} /> 编辑
                  </Button>
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
              <Label className="mb-1 block text-xs">背景图片 URL</Label>
              <Input value={form.coverImageUrl} onChange={(e) => setForm((current) => ({ ...current, coverImageUrl: e.target.value }))} />
            </div>
          </div>

          <DialogFooter>
            {editing && <Button type="button" variant="outline" onClick={deleteFolder} disabled={saving}>删除</Button>}
            <Button type="button" onClick={saveFolder} disabled={saving}>{saving ? "保存中..." : "保存"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
