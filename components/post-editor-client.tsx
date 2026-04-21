"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ArrowLeft, Trash2 } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { MarkdownEditor } from "@/components/markdown-editor"

interface PostEditorClientProps {
  mode: "create" | "edit"
  type: "blog" | "daily" | "reflections" | "notes"
  typeLabel: string
  initialData?: {
    id: string
    slug: string
    title: string
    summary: string
    tags: string[]
    content: string
    date: string
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
    .replace(/[^a-z0-9\u4e00-\u9fa5-]/g, "")
    .slice(0, 80) || Date.now().toString()
}

export function PostEditorClient({ mode, type, typeLabel, initialData }: PostEditorClientProps) {
  const router = useRouter()
  const base = TYPE_BASE[type]

  const [title, setTitle] = useState(initialData?.title ?? "")
  const [summary, setSummary] = useState(initialData?.summary ?? "")
  const [tagsRaw, setTagsRaw] = useState((initialData?.tags ?? []).join(", "))
  const [content, setContent] = useState(initialData?.content ?? "")
  const [date, setDate] = useState(
    initialData?.date?.slice(0, 10) ?? new Date().toISOString().slice(0, 10)
  )
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleSave() {
    if (!title.trim()) { toast.error("标题不能为空"); return }
    setSaving(true)
    try {
      const tags = tagsRaw.split(",").map((t) => t.trim()).filter(Boolean)
      const body = { title, summary, tags, content, date }

      if (mode === "create") {
        const slug = slugify(title) + "-" + Date.now().toString(36)
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

  return (
    <div className="max-w-[900px] mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-6">
        <Link
          href={mode === "edit" && initialData ? `${base}/${initialData.slug}` : base}
          className="inline-flex items-center gap-1 text-sm text-[--color-text-muted] hover:text-[--color-text-primary] hover:no-underline"
        >
          <ArrowLeft size={14} /> {mode === "create" ? `返回${typeLabel}列表` : "取消编辑"}
        </Link>
        <div className="flex gap-2">
          {mode === "edit" && (
            <Button variant="outline" size="sm" onClick={handleDelete} disabled={deleting} className="gap-1.5 text-[--color-danger]">
              <Trash2 size={13} /> 删除
            </Button>
          )}
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? "保存中..." : mode === "create" ? "发布" : "保存"}
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <Label className="text-xs mb-1 block">标题 *</Label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="文章标题"
            className="text-lg font-semibold h-10"
          />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <Label className="text-xs mb-1 block">摘要</Label>
            <Input
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="一行摘要，显示在列表页"
              className="h-8 text-sm"
            />
          </div>
          <div>
            <Label className="text-xs mb-1 block">日期</Label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-8 text-sm font-mono"
            />
          </div>
        </div>
        <div>
          <Label className="text-xs mb-1 block">标签（逗号分隔）</Label>
          <Input
            value={tagsRaw}
            onChange={(e) => setTagsRaw(e.target.value)}
            placeholder="React, TypeScript, 前端"
            className="h-8 text-sm"
          />
        </div>
        <div>
          <Label className="text-xs mb-1 block">正文</Label>
          <MarkdownEditor value={content} onChange={setContent} height={520} />
        </div>
      </div>
    </div>
  )
}
