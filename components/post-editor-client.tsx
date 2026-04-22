"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Eye, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { ArticleAside } from "@/components/article-sidebar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { MarkdownEditor } from "@/components/markdown-editor"
import { MarkdownContent } from "@/components/markdown-content"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { CreatorProfile } from "@/lib/profile"

interface PostEditorClientProps {
  mode: "create" | "edit"
  type: "blog" | "daily" | "reflections" | "notes"
  typeLabel: string
  creator?: CreatorProfile | null
  initialData?: {
    id: string
    slug: string
    title: string
    summary: string
    tags: string[]
    content: string
    date: string
    visibility: string
  }
}

const TYPE_BASE: Record<string, string> = {
  blog: "/blog",
  daily: "/daily",
  reflections: "/reflections",
  notes: "/notes",
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9一-龥-]/g, "")
    .slice(0, 80) || Date.now().toString()
}

export function PostEditorClient({ mode, type, typeLabel, creator, initialData }: PostEditorClientProps) {
  const router = useRouter()
  const base = TYPE_BASE[type]

  const [title, setTitle] = useState(initialData?.title ?? "")
  const [summary, setSummary] = useState(initialData?.summary ?? "")
  const [tagsRaw, setTagsRaw] = useState((initialData?.tags ?? []).join(", "))
  const [content, setContent] = useState(initialData?.content ?? "")
  const [date, setDate] = useState(
    initialData?.date?.slice(0, 10) ?? new Date().toISOString().slice(0, 10)
  )
  const [visibility, setVisibility] = useState(initialData?.visibility ?? "private")
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)

  async function handleSave() {
    if (!title.trim()) {
      toast.error("标题不能为空")
      return
    }
    setSaving(true)
    try {
      const tags = tagsRaw.split(",").map((tag) => tag.trim()).filter(Boolean)
      const body = { title, summary, tags, content, date, visibility }

      if (mode === "create") {
        const slug = `${slugify(title)}-${Date.now().toString(36)}`
        const res = await fetch("/api/posts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type, slug, ...body }),
          cache: "no-store",
        })
        if (!res.ok) throw new Error()
        const post = await res.json()
        toast.success("已创建")
        router.push(`${base}/${encodeURIComponent(post.slug)}`)
      } else if (initialData) {
        const res = await fetch(`/api/posts/${initialData.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          cache: "no-store",
        })
        if (!res.ok) throw new Error()
        toast.success("已保存")
        router.push(`${base}/${encodeURIComponent(initialData.slug)}`)
      }
    } catch {
      toast.error("保存失败，请重试")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!initialData) return
    if (!confirm(`确认删除《${initialData.title}》？`)) return
    setDeleting(true)
    try {
      await fetch(`/api/posts/${initialData.id}`, { method: "DELETE", cache: "no-store" })
      toast.success("已删除")
      router.push(base)
    } catch {
      toast.error("删除失败")
    } finally {
      setDeleting(false)
    }
  }

  const backHref = mode === "edit" && initialData ? `${base}/${initialData.slug}` : base

  return (
    <div className="mx-auto grid w-full max-w-[1360px] grid-cols-1 gap-6 px-6 py-8 lg:grid-cols-[minmax(0,1fr)_300px]">
      <section className="min-w-0">
        <div className="mb-5 flex items-center justify-between gap-4">
          <Link
            href={backHref}
            className="inline-flex items-center gap-1.5 text-sm text-[--color-text-muted] hover:text-[--color-text-primary] hover:no-underline"
          >
            <ArrowLeft size={14} /> {mode === "create" ? `返回${typeLabel}列表` : "返回查看模式"}
          </Link>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPreviewOpen(true)}
              className="gap-1.5"
            >
              <Eye size={14} /> 预览
            </Button>
            {mode === "edit" && (
              <Button variant="outline" size="sm" onClick={handleDelete} disabled={deleting} className="gap-1.5 text-[--color-danger]">
                <Trash2 size={14} /> 删除
              </Button>
            )}
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? "保存中..." : mode === "create" ? "发布" : "保存"}
            </Button>
          </div>
        </div>

        <div className="rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface] p-5 shadow-sm">
          <div className="grid gap-4">
            <div>
              <Label className="mb-1 block text-xs">标题 *</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="文章标题"
                className="h-11 text-lg font-semibold"
              />
            </div>
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px]">
              <div>
                <Label className="mb-1 block text-xs">摘要</Label>
                <Input
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="一行摘要，显示在列表页"
                  className="h-9 text-sm"
                />
              </div>
              <div>
                <Label className="mb-1 block text-xs">日期</Label>
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="h-9 text-sm font-mono"
                />
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_150px]">
              <div>
                <Label className="mb-1 block text-xs">标签（逗号分隔）</Label>
                <Input
                  value={tagsRaw}
                  onChange={(e) => setTagsRaw(e.target.value)}
                  placeholder="React, TypeScript, 前端"
                  className="h-9 text-sm"
                />
              </div>
              <div>
                <Label className="mb-1 block text-xs">可见性</Label>
                <select
                  value={visibility === "friends" ? "friends" : "private"}
                  onChange={(event) => setVisibility(event.target.value)}
                  className="h-9 w-full rounded-[--radius-sm] border border-[--color-border-strong] bg-[--color-bg-surface] px-2.5 text-sm text-[--color-text-primary] outline-none hover:bg-[--color-bg-hover] focus:border-[--color-text-primary]"
                >
                  <option value="private">私密</option>
                  <option value="friends">好友可见</option>
                </select>
              </div>
            </div>
            <div>
              <Label className="mb-2 block text-xs">正文</Label>
              <MarkdownEditor
                value={content}
                onChange={setContent}
                height={620}
                postId={initialData?.id}
              />
            </div>
          </div>
        </div>
      </section>

      {creator && <ArticleAside profile={creator} content={content} />}

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{title || "预览"}</DialogTitle>
          </DialogHeader>
          <div className="prose mt-2">
            <MarkdownContent source={content} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
