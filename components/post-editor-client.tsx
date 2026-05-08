"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Calendar, Check, Cloud, CloudOff, Eye, FileText, Folder, Hash, Lock, RotateCcw, Trash2, X } from "lucide-react"
import { toast } from "sonner"
import { ArticleAside } from "@/components/article-sidebar"
import { ArticleWorkspaceShell } from "@/components/article-workspace-shell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { MarkdownEditor } from "@/components/markdown-editor"
import { MarkdownContent } from "@/components/markdown-content"
import { readUserStorage, removeUserStorage, userStorageKey, writeUserStorage } from "@/lib/client-storage"
import { getDict } from "@/lib/i18n"
import { confirmAction } from "@/lib/interaction-feedback"
import { nowSingaporeLocalIsoLite, singaporeLocalToIsoString, isoStringToSingaporeLocal } from "@/lib/time"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { CreatorProfile } from "@/lib/profile"
import type { ArticleWorkspaceNav } from "@/lib/article-workspace"

interface PostEditorClientProps {
  mode: "create" | "edit"
  type: "blog" | "daily" | "reflections" | "notes"
  typeLabel: string
  userId: string
  creator?: CreatorProfile | null
  workspaceNav?: ArticleWorkspaceNav
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

export function PostEditorClient({ mode, type, typeLabel, userId, creator, workspaceNav, initialData }: PostEditorClientProps) {
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
    date: initialData?.date ? isoStringToSingaporeLocal(initialData.date) : nowSingaporeLocalIsoLite(),
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
  const [pendingDraft, setPendingDraft] = useState<EditorDraft | null>(null)
  const [draftSavedAt, setDraftSavedAt] = useState<number | null>(null)
  const [draftStatus, setDraftStatus] = useState<"idle" | "dirty" | "saved">("idle")
  const [now, setNow] = useState(0)

  useEffect(() => {
    const check = () => {
      setIsMobile(window.innerWidth < 768)
      setMounted(true)
    }
    check()
    window.addEventListener("resize", check)
    return () => window.removeEventListener("resize", check)
  }, [])

  useEffect(() => {
    const draft = readUserStorage<Partial<EditorDraft> & { __savedAt?: number }>({
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

      if (hasDraftContent && differs) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- surface pending draft once after mount
        setPendingDraft({
          title: draft.title ?? "",
          summary: draft.summary ?? "",
          tagsRaw: draft.tagsRaw ?? "",
          content: draft.content ?? "",
          date: draft.date ?? nowSingaporeLocalIsoLite(),
          visibility: draft.visibility ?? "private",
          folderId: draft.folderId ?? "",
        })
        if (typeof draft.__savedAt === "number") setDraftSavedAt(draft.__savedAt)
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
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset status when draft equals initial
      setDraftStatus("idle")
      setDraftSavedAt(null)
      return
    }
    setDraftStatus("dirty")
    const handle = window.setTimeout(() => {
      const savedAt = Date.now()
      writeUserStorage({ kind: "local", key: draftKey, userId, value: { ...draft, __savedAt: savedAt } })
      setDraftSavedAt(savedAt)
      setDraftStatus("saved")
    }, 400)
    return () => window.clearTimeout(handle)
  }, [content, date, draftKey, folderId, initialDraft, summary, tagsRaw, title, userId, visibility])

  // Track the current time in state so the "saved X ago" label can recompute purely from props/state.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- seed clock once on mount, refresh via interval
    setNow(Date.now())
    if (draftStatus !== "saved" || !draftSavedAt) return
    const handle = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(handle)
  }, [draftStatus, draftSavedAt])

  function applyPendingDraft() {
    if (!pendingDraft) return
    setTitle(pendingDraft.title)
    setSummary(pendingDraft.summary)
    setTagsRaw(pendingDraft.tagsRaw)
    setContent(pendingDraft.content)
    setDate(pendingDraft.date || nowSingaporeLocalIsoLite())
    setVisibility(pendingDraft.visibility)
    setFolderId(pendingDraft.folderId)
    setPendingDraft(null)
    toast.success(dict.editor.draftLoaded)
  }

  function dismissPendingDraft() {
    setPendingDraft(null)
    removeUserStorage("local", draftKey)
    setDraftSavedAt(null)
    setDraftStatus("idle")
  }

  function formatRelativeTime(ts: number): string {
    if (now === 0) return ""
    const seconds = Math.max(0, Math.floor((now - ts) / 1000))
    if (seconds < 5) return isZh ? "刚刚" : "just now"
    if (seconds < 60) return isZh ? `${seconds} 秒前` : `${seconds}s ago`
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return isZh ? `${minutes} 分钟前` : `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return isZh ? `${hours} 小时前` : `${hours}h ago`
    const days = Math.floor(hours / 24)
    return isZh ? `${days} 天前` : `${days}d ago`
  }

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
      const isoDate = date ? singaporeLocalToIsoString(date) : new Date().toISOString()
      const body = { title, summary, tags, content, date: isoDate, visibility, folderId: folderId || null }

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
    if (!confirmAction(`${dict.editor.deleteConfirm(initialData.title)}\n删除后文章会从当前模块中移除，无法直接恢复。`)) return
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

  // ── Draft banner + saved status ─────────────────────────────────────────────
  const draftBanner = pendingDraft ? (
    <div
      role="status"
      className="mb-4 flex flex-wrap items-center gap-3 rounded-md border border-[--color-border] bg-[#fff8e6] px-3 py-2 text-sm text-[--color-text-primary]"
    >
      <RotateCcw size={15} className="text-[--color-warning]" />
      <span className="flex-1 min-w-0">
        {isZh
          ? `检测到${draftSavedAt ? ` ${formatRelativeTime(draftSavedAt)}` : ""}的本地草稿`
          : `Local draft${draftSavedAt ? ` from ${formatRelativeTime(draftSavedAt)}` : ""} detected`}
      </span>
      <button
        type="button"
        onClick={applyPendingDraft}
        className="inline-flex h-7 items-center gap-1 rounded-md bg-[--color-text-primary] px-2.5 text-xs text-white"
      >
        <Check size={13} /> {isZh ? "恢复" : "Restore"}
      </button>
      <button
        type="button"
        onClick={dismissPendingDraft}
        className="inline-flex h-7 items-center gap-1 rounded-md border border-[--color-border] px-2.5 text-xs text-[--color-text-secondary]"
      >
        <X size={13} /> {isZh ? "忽略" : "Discard"}
      </button>
    </div>
  ) : null

  const savedBadge = (
    <span
      className="inline-flex items-center gap-1 text-xs text-[--color-text-muted]"
      aria-live="polite"
    >
      {draftStatus === "dirty" ? (
        <>
          <CloudOff size={12} /> {isZh ? "尚未保存" : "Unsaved"}
        </>
      ) : draftStatus === "saved" && draftSavedAt ? (
        <>
          <Cloud size={12} /> {isZh ? `自动保存 · ${formatRelativeTime(draftSavedAt)}` : `Saved · ${formatRelativeTime(draftSavedAt)}`}
        </>
      ) : null}
    </span>
  )

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
          type="datetime-local"
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
    <div className="notion-document notion-document-wide">
      <section className="min-w-0">
        <div className="notion-page-bar">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href={backHref}
              className="notion-icon-link"
            >
              <ArrowLeft size={14} /> {mode === "create" ? dict.editor.backToList(typeLabel) : dict.editor.backToView}
            </Link>
            {savedBadge}
          </div>
          <div className="flex min-w-0 items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPreviewOpen(true)}
              className="notion-toolbar-button min-h-8 gap-1.5 px-2 shadow-none hover:translate-y-0"
            >
              <Eye size={14} /> {dict.editor.preview}
            </Button>
            {mode === "edit" && (
              <Button variant="ghost" size="sm" onClick={handleDelete} loading={deleting} loadingText={dict.editor.delete} className="notion-toolbar-button min-h-8 gap-1.5 px-2 text-[--color-danger] shadow-none hover:translate-y-0">
                <Trash2 size={14} /> {dict.editor.delete}
              </Button>
            )}
            <Button size="sm" onClick={handleSave} loading={saving} loadingText={dict.editor.saving} className="min-h-8 rounded-md px-3 shadow-none hover:translate-y-0">
              {mode === "create" ? dict.editor.publish : dict.editor.save}
            </Button>
          </div>
        </div>

        <div className="min-w-0">
          {draftBanner}
          <div className="grid min-w-0 gap-4">
            <div>
              <Label className="sr-only">{dict.editor.title} *</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={dict.editor.titlePlaceholder}
                className="notion-title-input h-auto rounded-none border-0 bg-transparent px-0 py-0 shadow-none focus-visible:border-0 focus-visible:shadow-none"
              />
            </div>
            <div className="notion-properties">
              <div className="notion-property-row">
                <Label className="notion-property-label"><FileText size={14} /> {dict.editor.summary}</Label>
                <Input
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder={dict.editor.summaryPlaceholder}
                  className="notion-input h-auto rounded-md border-0 bg-transparent px-2 py-1.5 shadow-none focus-visible:border-0 focus-visible:shadow-none"
                />
              </div>
              <div className="notion-property-row">
                <Label className="notion-property-label"><Calendar size={14} /> {dict.editor.date}</Label>
                <input
                  type="datetime-local"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="notion-input font-mono"
                />
              </div>
              <div className="notion-property-row">
                <Label className="notion-property-label"><Hash size={14} /> {dict.editor.tags}</Label>
                <Input
                  value={tagsRaw}
                  onChange={(e) => setTagsRaw(e.target.value)}
                  placeholder={dict.editor.tagsPlaceholder}
                  className="notion-input h-auto rounded-md border-0 bg-transparent px-2 py-1.5 shadow-none focus-visible:border-0 focus-visible:shadow-none"
                />
              </div>
              <div className="notion-property-row">
                <Label className="notion-property-label"><Lock size={14} /> {dict.editor.visibility}</Label>
                <select
                  value={visibility === "friends" ? "friends" : "private"}
                  onChange={(event) => setVisibility(event.target.value)}
                  className="notion-select"
                >
                  <option value="private">{dict.article.visibilityPrivate}</option>
                  <option value="friends">{dict.article.visibilityFriends}</option>
                </select>
              </div>
              <div className="notion-property-row">
                <Label className="notion-property-label"><Folder size={14} /> {dict.editor.folder}</Label>
                <select
                  value={folderId}
                  onChange={(event) => setFolderId(event.target.value)}
                  className="notion-select"
                >
                  <option value="">{dict.editor.folderUncategorized}</option>
                  {folders.map((folder) => (
                    <option key={folder.id} value={folder.id}>{folder.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="notion-editor-surface min-w-0">
              <Label className="sr-only">{dict.editor.content}</Label>
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
    </div>
  )

  // ── Mobile layout ───────────────────────────────────────────────────────────
  const mobileLayout = (
    <div className="mobile-editor-layout">
      {/* Top bar */}
      <div className="mobile-editor-topbar">
        <div className="flex items-center gap-2 min-w-0">
          <Link
            href={backHref}
            className="inline-flex items-center gap-1 text-sm text-[--color-text-muted] hover:text-[--color-text-primary] hover:no-underline shrink-0"
          >
            <ArrowLeft size={16} />
          </Link>
          {savedBadge}
        </div>
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
              loading={deleting}
              loadingText={dict.editor.delete}
              className="gap-1.5 text-[--color-danger]"
            >
              <Trash2 size={14} /> {dict.editor.delete}
            </Button>
          )}
          <Button
            size="sm"
            onClick={handleSave}
            loading={saving}
            loadingText={dict.editor.saving}
            className="h-8 gap-1 rounded-full px-3 text-xs"
          >
            {mode === "create" ? dict.editor.publish : dict.editor.save}
          </Button>
        </div>
      </div>

      {/* Draft banner */}
      {draftBanner ? <div className="px-3 pt-3">{draftBanner}</div> : null}

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
        />
      </div>
    </div>
  )

  const editorAside = creator ? <ArticleAside profile={creator} content={content} mode="rail" /> : undefined
  const mobileAside = creator ? <ArticleAside profile={creator} content={content} mode="stack" /> : undefined

  return (
    <ArticleWorkspaceShell workspaceNav={workspaceNav} rightRail={editorAside} mobileAfter={mobileAside}>
      {!mounted ? desktopLayout : isMobile ? mobileLayout : desktopLayout}

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
    </ArticleWorkspaceShell>
  )
}
