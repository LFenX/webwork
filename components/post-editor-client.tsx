"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Eye, Trash2 } from "lucide-react"
import { toast } from "sonner"
import type { Editor } from "@tiptap/core"
import { ArticleAside } from "@/components/article-sidebar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { MarkdownEditor } from "@/components/markdown-editor"
import { MarkdownContent } from "@/components/markdown-content"
import { MobileFloatingToolbar } from "@/components/mobile-floating-toolbar"
import { readUserStorage, removeUserStorage, userStorageKey, writeUserStorage } from "@/lib/client-storage"
import { getDict } from "@/lib/i18n"
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
  userId: string
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
    folderId?: string | null
  }
}

type FolderOption = {
  id: string
  name: string
}

type EditorDraft = {
  title: string
  summary: string
  tagsRaw: string
  content: string
  date: string
  visibility: string
  folderId: string
}

const DRAFT_TTL_MS = 30 * 24 * 60 * 60 * 1000
const FOLDER_CACHE_TTL_MS = 5 * 60 * 1000

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

export function PostEditorClient({ mode, type, typeLabel, userId, creator, initialData }: PostEditorClientProps) {
  const router = useRouter()
  const dict = getDict()
  const isZh = dict.common.save === "保存"
  const base = TYPE_BASE[type]
  const draftKey = useMemo(
    () => userStorageKey(userId, "post-draft", `${type}:${initialData?.id ?? mode}`),
    [initialData?.id, mode, type, userId]
  )
  const folderCacheKey = useMemo(() => userStorageKey(userId, "article-folders", type), [type, userId])
  const initialDraft = useMemo<EditorDraft>(() => ({
    title: initialData?.title ?? "",
    summary: initialData?.summary ?? "",
    tagsRaw: (initialData?.tags ?? []).join(", "),
    content: initialData?.content ?? "",
    date: initialData?.date?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
    visibility: initialData?.visibility ?? "private",
    folderId: initialData?.folderId ?? "",
  }), [initialData])
  const draftReady = useRef(false)

  const [title, setTitle] = useState(initialDraft.title)
  const [summary, setSummary] = useState(initialDraft.summary)
  const [tagsRaw, setTagsRaw] = useState(initialDraft.tagsRaw)
  const [content, setContent] = useState(initialDraft.content)
  const [date, setDate] = useState(initialDraft.date)
  const [visibility, setVisibility] = useState(initialDraft.visibility)
  const [folderId, setFolderId] = useState(initialDraft.folderId)
  const [folders, setFolders] = useState<FolderOption[]>([])
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [editType, setEditType] = useState<"wysiwyg" | "markdown">("wysiwyg")
  const editorRef = useRef<Editor | null>(null)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    setMounted(true)
    window.addEventListener("resize", check)
    return () => window.removeEventListener("resize", check)
  }, [])

  const handleEditorReady = useCallback((editor: Editor) => {
    editorRef.current = editor
  }, [])

  const handleToggleEditType = useCallback(() => {
    setEditType((prev) => prev === "wysiwyg" ? "markdown" : "wysiwyg")
  }, [])

  useEffect(() => {
    const draft = readUserStorage<Partial<EditorDraft>>({
      kind: "local",
      key: draftKey,
      userId,
      ttlMs: DRAFT_TTL_MS,
    })
    if (!draft) {
      draftReady.current = true
      return
    }

    try {
      const hasDraftContent = Boolean(
        draft.title || draft.summary || draft.tagsRaw || draft.content || draft.folderId
      )
      const differs =
        draft.title !== title ||
        draft.summary !== summary ||
        draft.tagsRaw !== tagsRaw ||
        draft.content !== content ||
        draft.date !== date ||
        draft.visibility !== visibility ||
        draft.folderId !== folderId

      if (hasDraftContent && differs && window.confirm(isZh ? "检测到未保存的本地草稿，是否恢复？" : "Unsaved draft detected. Restore it?")) {
        window.setTimeout(() => {
          setTitle(draft.title ?? "")
          setSummary(draft.summary ?? "")
          setTagsRaw(draft.tagsRaw ?? "")
          setContent(draft.content ?? "")
          setDate(draft.date ?? new Date().toISOString().slice(0, 10))
          setVisibility(draft.visibility ?? "private")
          setFolderId(draft.folderId ?? "")
          toast.success(dict.editor.draftLoaded)
        }, 0)
      }
    } catch {
      removeUserStorage("local", draftKey)
    } finally {
      draftReady.current = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey])

  useEffect(() => {
    if (!draftReady.current) return
    const draft: EditorDraft = { title, summary, tagsRaw, content, date, visibility, folderId }
    if (JSON.stringify(draft) === JSON.stringify(initialDraft)) {
      removeUserStorage("local", draftKey)
      return
    }
    writeUserStorage({ kind: "local", key: draftKey, userId, value: draft })
  }, [content, date, draftKey, folderId, initialDraft, summary, tagsRaw, title, userId, visibility])

  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (!draftReady.current) return
      const saved = readUserStorage<EditorDraft>({ kind: "local", key: draftKey, userId, ttlMs: DRAFT_TTL_MS })
      if (!saved) return
      event.preventDefault()
      event.returnValue = ""
    }

    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => window.removeEventListener("beforeunload", handleBeforeUnload)
  }, [draftKey, userId])

  useEffect(() => {
    let active = true
    const cached = readUserStorage<FolderOption[]>({ kind: "session", key: folderCacheKey, userId, ttlMs: FOLDER_CACHE_TTL_MS })
    if (cached) window.setTimeout(() => setFolders(cached), 0)
    fetch(`/api/article-folders?type=${type}`, { cache: "no-store" })
      .then((res) => res.ok ? res.json() : [])
      .then((data) => {
        if (active && Array.isArray(data)) {
          setFolders(data)
          writeUserStorage({ kind: "session", key: folderCacheKey, userId, value: data })
        }
      })
      .catch(() => null)
    return () => {
      active = false
    }
  }, [folderCacheKey, type, userId])

  async function handleSave() {
    if (!title.trim()) {
      toast.error(isZh ? "标题不能为空" : "Title cannot be empty")
      return
    }
    setSaving(true)
    try {
      const tags = tagsRaw.split(",").map((tag) => tag.trim()).filter(Boolean)
      const body = { title, summary, tags, content, date, visibility, folderId: folderId || null }

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
        removeUserStorage("local", draftKey)
        toast.success(dict.editor.published)
        router.push(`${base}/${encodeURIComponent(post.slug)}`)
      } else if (initialData) {
        const res = await fetch(`/api/posts/${initialData.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          cache: "no-store",
        })
        if (!res.ok) throw new Error()
        removeUserStorage("local", draftKey)
        toast.success(dict.editor.saved)
        router.push(`${base}/${encodeURIComponent(initialData.slug)}`)
      }
    } catch {
      toast.error(isZh ? "保存失败，请重试" : "Save failed, please try again")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!initialData) return
    if (!confirm(dict.editor.deleteConfirm(initialData.title))) return
    setDeleting(true)
    try {
      await fetch(`/api/posts/${initialData.id}`, { method: "DELETE", cache: "no-store" })
      removeUserStorage("local", draftKey)
      toast.success(dict.article.deleteSuccess)
      router.push(base)
    } catch {
      toast.error(dict.article.deleteFailed)
    } finally {
      setDeleting(false)
    }
  }

  const backHref = mode === "edit" && initialData ? `${base}/${initialData.slug}` : base

  // ── Shared meta fields ──────────────────────────────────────────────────────
  const metaFieldsContent = (
    <>
      {/* Title */}
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={dict.editor.titlePlaceholder}
        className="mobile-editor-title-input"
      />
      {/* Summary */}
      <input
        value={summary}
        onChange={(e) => setSummary(e.target.value)}
        placeholder={dict.editor.summaryPlaceholder}
        className="mobile-editor-meta-input"
      />
      {/* Date + visibility row */}
      <div className="mobile-editor-meta-row">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="mobile-editor-date-input"
        />
        <select
          value={visibility === "friends" ? "friends" : "private"}
          onChange={(event) => setVisibility(event.target.value)}
          className="mobile-editor-select"
        >
          <option value="private">{dict.article.visibilityPrivate}</option>
          <option value="friends">{dict.article.visibilityFriends}</option>
        </select>
      </div>
      {/* Tags */}
      <input
        value={tagsRaw}
        onChange={(e) => setTagsRaw(e.target.value)}
        placeholder={dict.editor.tagsPlaceholder}
        className="mobile-editor-meta-input"
      />
      {/* Folder */}
      <select
        value={folderId}
        onChange={(event) => setFolderId(event.target.value)}
        className="mobile-editor-select"
      >
        <option value="">{dict.editor.folderUncategorized}</option>
        {folders.map((folder) => (
          <option key={folder.id} value={folder.id}>{folder.name}</option>
        ))}
      </select>
    </>
  )

  // ── Desktop layout (unchanged) ──────────────────────────────────────────────
  const desktopLayout = (
    <div className="mx-auto grid w-full max-w-[1360px] grid-cols-1 gap-6 px-6 py-8 lg:grid-cols-[minmax(0,1fr)_300px]">
      <section className="min-w-0">
        <div className="mb-5 flex items-center justify-between gap-4">
          <Link
            href={backHref}
            className="inline-flex items-center gap-1.5 text-sm text-[--color-text-muted] hover:text-[--color-text-primary] hover:no-underline"
          >
            <ArrowLeft size={14} /> {mode === "create" ? dict.editor.backToList(typeLabel) : dict.editor.backToView}
          </Link>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPreviewOpen(true)}
              className="gap-1.5"
            >
              <Eye size={14} /> {dict.editor.preview}
            </Button>
            {mode === "edit" && (
              <Button variant="outline" size="sm" onClick={handleDelete} disabled={deleting} className="gap-1.5 text-[--color-danger]">
                <Trash2 size={14} /> {dict.editor.delete}
              </Button>
            )}
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? dict.editor.saving : mode === "create" ? dict.editor.publish : dict.editor.save}
            </Button>
          </div>
        </div>

        <div className="min-w-0 overflow-hidden rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface] p-5 shadow-sm">
          <div className="grid min-w-0 gap-4">
            <div>
              <Label className="mb-1 block text-xs">{dict.editor.title} *</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={dict.editor.titlePlaceholder}
                className="h-11 w-full min-w-0 text-lg font-semibold"
              />
            </div>
            <div className="grid min-w-0 gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
              <div className="min-w-0">
                <Label className="mb-1 block text-xs">{dict.editor.summary}</Label>
                <Input
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder={dict.editor.summaryPlaceholder}
                  className="h-9 w-full min-w-0 text-sm"
                />
              </div>
              <div className="min-w-0">
                <Label className="mb-1 block text-xs">{dict.editor.date}</Label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="h-9 w-full rounded-[10px] border border-input bg-background px-4 py-2 text-sm font-mono transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-brand]/30 focus-visible:ring-offset-2 focus-visible:border-[--color-brand]"
                />
              </div>
            </div>
            <div className="grid min-w-0 gap-3 md:grid-cols-[minmax(0,1fr)_150px]">
              <div className="min-w-0">
                <Label className="mb-1 block text-xs">{dict.editor.tags}</Label>
                <Input
                  value={tagsRaw}
                  onChange={(e) => setTagsRaw(e.target.value)}
                  placeholder={dict.editor.tagsPlaceholder}
                  className="h-9 w-full min-w-0 text-sm"
                />
              </div>
              <div className="min-w-0">
                <Label className="mb-1 block text-xs">{dict.editor.visibility}</Label>
                <select
                  value={visibility === "friends" ? "friends" : "private"}
                  onChange={(event) => setVisibility(event.target.value)}
                  className="h-9 w-full min-w-0 rounded-[--radius-sm] border border-[--color-border-strong] bg-[--color-bg-surface] px-2.5 text-sm text-[--color-text-primary] outline-none hover:bg-[--color-bg-hover] focus:border-[--color-text-primary]"
                >
                  <option value="private">{dict.article.visibilityPrivate}</option>
                  <option value="friends">{dict.article.visibilityFriends}</option>
                </select>
              </div>
            </div>
            <div>
              <Label className="mb-1 block text-xs">{dict.editor.folder}</Label>
              <select
                value={folderId}
                onChange={(event) => setFolderId(event.target.value)}
                className="h-9 w-full rounded-[--radius-sm] border border-[--color-border-strong] bg-[--color-bg-surface] px-2.5 text-sm text-[--color-text-primary] outline-none hover:bg-[--color-bg-hover] focus:border-[--color-text-primary]"
              >
                <option value="">{dict.editor.folderUncategorized}</option>
                {folders.map((folder) => (
                  <option key={folder.id} value={folder.id}>{folder.name}</option>
                ))}
              </select>
            </div>
            <div className="min-w-0">
              <Label className="mb-2 block text-xs">{dict.editor.content}</Label>
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
    </div>
  )

  // ── Mobile layout ───────────────────────────────────────────────────────────
  const mobileLayout = (
    <div className="mobile-editor-layout">
      {/* Top bar */}
      <div className="mobile-editor-topbar">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1 text-sm text-[--color-text-muted] hover:text-[--color-text-primary] hover:no-underline shrink-0"
        >
          <ArrowLeft size={16} />
        </Link>
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPreviewOpen(true)}
            className="gap-1.5"
          >
            <Eye size={14} /> {dict.editor.preview}
          </Button>
          {mode === "edit" && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleDelete}
              disabled={deleting}
              className="gap-1.5 text-[--color-danger]"
            >
              <Trash2 size={14} /> {dict.editor.delete}
            </Button>
          )}
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving}
            className="h-8 gap-1 rounded-full px-3 text-xs"
          >
            {saving ? dict.editor.saving : mode === "create" ? dict.editor.publish : dict.editor.save}
          </Button>
        </div>
      </div>

      {/* Meta fields — Notion style */}
      <div className="mobile-editor-meta">
        {metaFieldsContent}
      </div>

      {/* Content area */}
      <div className="mobile-editor-content-area">
        <MarkdownEditor
          value={content}
          onChange={setContent}
          height={typeof window !== "undefined" ? Math.max(400, window.innerHeight - 220) : 600}
          postId={initialData?.id}
          hideToolbar
          onEditorReady={handleEditorReady}
          editType={editType}
          onToggleEditType={handleToggleEditType}
        />
      </div>

      {/* Floating toolbar */}
      {mounted && isMobile && editorRef.current && (
        <MobileFloatingToolbar
          editor={editorRef.current}
          postId={initialData?.id}
          onOpenImageManager={() => {
            // Image manager is handled within the toolbar via the more panel
          }}
          editType={editType}
          onToggleEditType={handleToggleEditType}
        />
      )}
    </div>
  )

  return (
    <>
      {!mounted && desktopLayout}
      {mounted && (
        <>
          <div className={isMobile ? "hidden" : ""}>{desktopLayout}</div>
          {isMobile && mobileLayout}
        </>
      )}

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{title || dict.editor.preview}</DialogTitle>
          </DialogHeader>
          <div className="prose mt-2">
            <MarkdownContent source={content} />
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
