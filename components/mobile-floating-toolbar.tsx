"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import type { Editor } from "@tiptap/react"
import {
  Bold, Italic, Underline, Heading2, List, Quote, Code, Link2,
  Image as ImageIcon, MoreHorizontal, X, Strikethrough, Heading1,
  Heading3, Heading4, ListOrdered, Code2, CheckSquare, AlignLeft,
  AlignCenter, AlignRight, Highlighter, Table, Minus, Undo2, Redo2,
  FileCode2, FunctionSquare, Subscript, Superscript,
  AlertCircle, ChevronDown, SeparatorHorizontal, PenLine,
} from "lucide-react"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ALLOWED_MIME, UPLOAD_ERROR_MESSAGES } from "@/lib/upload"

interface MobileFloatingToolbarProps {
  editor: Editor | null
  postId?: string
  onOpenImageManager: () => void
  editType: "wysiwyg" | "markdown"
  onToggleEditType: () => void
}

const TEXT_COLORS = [
  "#1A1A1A", "#6B6B6B", "#9A9A9A", "#EF4444", "#F97316",
  "#EAB308", "#22C55E", "#3B82F6", "#8B5CF6", "#EC4899",
]

const HIGHLIGHT_COLORS = [
  "#FEF9C3", "#FEE2E2", "#DBEAFE", "#DCFCE7", "#F3E8FF",
]

const FAB_SIZE = 44
const TOOLBAR_MARGIN = 12
const DEFAULT_FAB_BOTTOM = 100
const DRAG_THRESHOLD = 8

// ── Sub-components ──────────────────────────────────────────────────────────

function ToolBtn({
  onClick, active, disabled, title, children,
}: {
  onClick?: () => void
  active?: boolean
  disabled?: boolean
  title?: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onClick?.() }}
      onTouchStart={(e) => { e.preventDefault(); onClick?.() }}
      disabled={disabled}
      title={title}
      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors ${
        active
          ? "bg-[--color-text-primary] text-white"
          : "text-[--color-text-secondary] active:bg-[--color-bg-hover]"
      } disabled:opacity-40`}
    >
      {children}
    </button>
  )
}

function MoreToolBtn({
  onClick, active, disabled, title, children,
}: {
  onClick?: () => void
  active?: boolean
  disabled?: boolean
  title?: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onClick?.() }}
      onTouchStart={(e) => { e.preventDefault(); onClick?.() }}
      disabled={disabled}
      title={title}
      className={`flex flex-col items-center gap-1 rounded-xl p-2.5 text-xs transition-colors ${
        active
          ? "bg-[--color-text-primary] text-white"
          : disabled
            ? "text-[--color-text-muted] opacity-50"
            : "text-[--color-text-secondary] bg-[--color-bg-hover] active:bg-[--color-border]"
      }`}
    >
      {children}
    </button>
  )
}

// ── Main component ──────────────────────────────────────────────────────────

export function MobileFloatingToolbar({
  editor, postId, onOpenImageManager, editType, onToggleEditType,
}: MobileFloatingToolbarProps) {
  // FAB position: distance from top of viewport in px
  const [fabTop, setFabTop] = useState(() =>
    typeof window !== "undefined" ? window.innerHeight - DEFAULT_FAB_BOTTOM - FAB_SIZE : 500
  )
  const [toolbarOpen, setToolbarOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [linkOpen, setLinkOpen] = useState(false)
  const [linkHref, setLinkHref] = useState("")
  const [linkText, setLinkText] = useState("")
  const [imageOpen, setImageOpen] = useState(false)
  const [imageUrl, setImageUrl] = useState("")
  const [imageUploading, setImageUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const fabRef = useRef<HTMLButtonElement>(null)
  const dragState = useRef({
    active: false,
    startY: 0,
    startFabTop: 0,
    totalMoved: 0,
  })

  // Recalculate FAB position on resize to keep it in bounds
  useEffect(() => {
    const handleResize = () => {
      setFabTop((prev) => {
        const max = window.innerHeight - FAB_SIZE - 8
        return Math.min(Math.max(8, prev), max)
      })
    }
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  // Lock body scroll when more panel is open
  useEffect(() => {
    if (moreOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => { document.body.style.overflow = "" }
  }, [moreOpen])

  // ── Drag handlers ─────────────────────────────────────────────────────────

  const clampY = useCallback((y: number) => {
    const max = window.innerHeight - FAB_SIZE - 8
    return Math.min(Math.max(8, y), max)
  }, [])

  const handleDragStart = useCallback((clientY: number) => {
    dragState.current = {
      active: true,
      startY: clientY,
      startFabTop: fabTop,
      totalMoved: 0,
    }
  }, [fabTop])

  const handleDragMove = useCallback((clientY: number) => {
    if (!dragState.current.active) return
    const dy = clientY - dragState.current.startY
    dragState.current.totalMoved = Math.abs(dy)
    setFabTop(clampY(dragState.current.startFabTop + dy))
  }, [clampY])

  const handleDragEnd = useCallback(() => {
    if (!dragState.current.active) return
    const moved = dragState.current.totalMoved
    dragState.current.active = false

    // If barely moved, treat as tap → toggle toolbar
    if (moved < DRAG_THRESHOLD) {
      setToolbarOpen((prev) => !prev)
    }
  }, [])

  // ── Close toolbar when tapping outside ────────────────────────────────────

  useEffect(() => {
    if (!toolbarOpen) return
    function handleClick(e: MouseEvent | TouchEvent) {
      const target = e.target as HTMLElement
      // Don't close if clicking FAB or toolbar or dialogs
      if (fabRef.current?.contains(target)) return
      if (target.closest(".mobile-fab-toolbar-pill")) return
      if (target.closest("[role=dialog]")) return
      if (target.closest(".mobile-more-overlay")) return
      setToolbarOpen(false)
    }
    // Delay to avoid the same tap that opened it
    const id = setTimeout(() => {
      document.addEventListener("touchstart", handleClick)
      document.addEventListener("mousedown", handleClick)
    }, 100)
    return () => {
      clearTimeout(id)
      document.removeEventListener("touchstart", handleClick)
      document.removeEventListener("mousedown", handleClick)
    }
  }, [toolbarOpen])

  // ── Image upload ──────────────────────────────────────────────────────────

  const insertImage = useCallback((src: string) => {
    editor?.chain().focus().setImage({ src }).run()
    setImageOpen(false)
    setImageUrl("")
  }, [editor])

  const uploadFile = useCallback(async (file: File) => {
    if (!ALLOWED_MIME.has(file.type)) {
      toast.error(UPLOAD_ERROR_MESSAGES.invalid_mime)
      return
    }
    setImageUploading(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      if (postId) fd.append("postId", postId)
      const res = await fetch("/api/upload", { method: "POST", body: fd })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error(UPLOAD_ERROR_MESSAGES[err.error as string] ?? "Upload failed")
        return
      }
      const { url } = await res.json()
      insertImage(url)
      toast.success("Image inserted")
    } finally {
      setImageUploading(false)
    }
  }, [editor, postId, insertImage])

  // ── Link dialog ───────────────────────────────────────────────────────────

  const openLinkDialog = useCallback(() => {
    const existing = editor?.getAttributes("link").href as string | undefined
    const { from, to } = editor?.state.selection ?? { from: 0, to: 0 }
    setLinkHref(existing ?? "")
    setLinkText(editor?.state.doc.textBetween(from, to) ?? "")
    setLinkOpen(true)
    setToolbarOpen(false)
  }, [editor])

  const handleLinkInsert = useCallback(() => {
    if (!linkHref.trim()) {
      editor?.chain().focus().extendMarkRange("link").unsetLink().run()
      setLinkOpen(false)
      return
    }
    if (linkText) {
      editor?.chain().focus().insertContent(`<a href="${linkHref.trim()}">${linkText}</a>`).run()
    } else {
      editor?.chain().focus().extendMarkRange("link").setLink({ href: linkHref.trim() }).run()
    }
    setLinkOpen(false)
    setLinkHref("")
    setLinkText("")
  }, [editor, linkHref, linkText])

  // ── More panel actions ────────────────────────────────────────────────────

  function insertHR() {
    editor?.chain().focus().insertContent({ type: "horizontalRule" }).run()
    setMoreOpen(false)
  }

  function insertMath(block: boolean) {
    editor?.chain().focus().insertContent({
      type: block ? "blockMath" : "inlineMath",
      attrs: { formula: block ? "E = mc^2" : "x^2" },
    }).run()
    setMoreOpen(false)
  }

  function insertDetails() {
    editor?.chain().focus().insertContent({
      type: "details", attrs: { open: true, summary: "Click to expand" },
      content: [{ type: "paragraph", content: [{ type: "text", text: "Content..." }] }],
    }).run()
    setMoreOpen(false)
  }

  function insertCallout(type: string) {
    editor?.chain().focus().insertContent({
      type: "callout", attrs: { type },
      content: [{ type: "paragraph", content: [{ type: "text", text: "Content" }] }],
    }).run()
    setMoreOpen(false)
  }

  function insertMermaid() {
    editor?.chain().focus().toggleCodeBlock({ language: "mermaid" }).run()
    setMoreOpen(false)
  }

  function insertPageBreak() {
    editor?.chain().focus().insertContent({ type: "pageBreak" }).run()
    setMoreOpen(false)
  }

  if (!editor) return null

  // ── Compute toolbar position relative to FAB ──────────────────────────────

  const fabRight = 12
  const fabCenterY = fabTop + FAB_SIZE / 2
  const toolbarAbove = fabCenterY > window.innerHeight * 0.5
  // Toolbar pill height is roughly 48px (h-10 inner + 8px padding)
  const toolPillHeight = 48

  const toolPillStyle: React.CSSProperties = toolbarAbove
    ? {
        bottom: `${window.innerHeight - fabTop + TOOLBAR_MARGIN}px`,
        right: `${fabRight}px`,
      }
    : {
        top: `${fabTop + FAB_SIZE + TOOLBAR_MARGIN}px`,
        right: `${fabRight}px`,
      }

  const mainTools = (
    <div className="flex items-center gap-0.5 overflow-x-auto px-0.5 scrollbar-none">
      <ToolBtn onClick={() => { editor.chain().focus().toggleBold().run(); setToolbarOpen(false) }} active={editor.isActive("bold")} title="Bold">
        <Bold size={16} />
      </ToolBtn>
      <ToolBtn onClick={() => { editor.chain().focus().toggleItalic().run(); setToolbarOpen(false) }} active={editor.isActive("italic")} title="Italic">
        <Italic size={16} />
      </ToolBtn>
      <ToolBtn onClick={() => { editor.chain().focus().toggleUnderline().run(); setToolbarOpen(false) }} active={editor.isActive("underline")} title="Underline">
        <Underline size={16} />
      </ToolBtn>
      <ToolBtn onClick={() => { editor.chain().focus().toggleHeading({ level: 2 }).run(); setToolbarOpen(false) }} active={editor.isActive("heading", { level: 2 })} title="Heading">
        <Heading2 size={16} />
      </ToolBtn>
      <ToolBtn onClick={() => { editor.chain().focus().toggleBulletList().run(); setToolbarOpen(false) }} active={editor.isActive("bulletList")} title="List">
        <List size={16} />
      </ToolBtn>
      <ToolBtn onClick={() => { editor.chain().focus().toggleBlockquote().run(); setToolbarOpen(false) }} active={editor.isActive("blockquote")} title="Quote">
        <Quote size={16} />
      </ToolBtn>
      <ToolBtn onClick={() => { editor.chain().focus().toggleCode().run(); setToolbarOpen(false) }} active={editor.isActive("code")} title="Code">
        <Code size={16} />
      </ToolBtn>
      <ToolBtn onClick={openLinkDialog} active={editor.isActive("link")} title="Link">
        <Link2 size={16} />
      </ToolBtn>
      <ToolBtn onClick={() => { setImageOpen(true); setToolbarOpen(false) }} title="Image">
        <ImageIcon size={16} />
      </ToolBtn>
      <ToolBtn onClick={() => { setMoreOpen(true); setToolbarOpen(false) }} active={moreOpen} title="More">
        <MoreHorizontal size={16} />
      </ToolBtn>
    </div>
  )

  return (
    <>
      {/* FAB */}
      <button
        ref={fabRef}
        type="button"
        className="mobile-editor-fab"
        style={{
          top: `${fabTop}px`,
          right: `${fabRight}px`,
          width: `${FAB_SIZE}px`,
          height: `${FAB_SIZE}px`,
        }}
        onTouchStart={(e) => {
          e.preventDefault()
          handleDragStart(e.touches[0].clientY)
        }}
        onTouchMove={(e) => {
          handleDragMove(e.touches[0].clientY)
        }}
        onTouchEnd={(e) => {
          e.preventDefault()
          handleDragEnd()
        }}
        onMouseDown={(e) => {
          e.preventDefault()
          handleDragStart(e.clientY)
          const handleMove = (ev: MouseEvent) => handleDragMove(ev.clientY)
          const handleUp = () => {
            handleDragEnd()
            document.removeEventListener("mousemove", handleMove)
            document.removeEventListener("mouseup", handleUp)
          }
          document.addEventListener("mousemove", handleMove)
          document.addEventListener("mouseup", handleUp)
        }}
        aria-label="Toggle editor toolbar"
      >
        <PenLine size={20} />
      </button>

      {/* Toolbar pill */}
      {toolbarOpen && (
        <div
          className="mobile-fab-toolbar-pill"
          style={toolPillStyle}
        >
          {mainTools}
        </div>
      )}

      {/* More bottom sheet */}
      {moreOpen && (
        <div className="mobile-more-overlay" onClick={() => setMoreOpen(false)}>
          <div
            className="mobile-more-sheet"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mobile-more-sheet-handle" />
            <div className="flex items-center justify-between px-1 mb-3">
              <span className="text-sm font-semibold text-[--color-text-primary]">More Tools</span>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[--color-text-muted] hover:bg-[--color-bg-hover]"
              >
                <X size={16} />
              </button>
            </div>

            <div className="grid grid-cols-5 gap-2">
              <MoreToolBtn onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Undo">
                <Undo2 size={18} />
                <span className="text-[10px]">Undo</span>
              </MoreToolBtn>
              <MoreToolBtn onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Redo">
                <Redo2 size={18} />
                <span className="text-[10px]">Redo</span>
              </MoreToolBtn>
              <MoreToolBtn onClick={() => { editor.chain().focus().toggleStrike().run(); setMoreOpen(false) }} active={editor.isActive("strike")} title="Strikethrough">
                <Strikethrough size={18} />
                <span className="text-[10px]">Strike</span>
              </MoreToolBtn>
              <MoreToolBtn onClick={() => { editor.chain().focus().toggleOrderedList().run(); setMoreOpen(false) }} active={editor.isActive("orderedList")} title="Ordered List">
                <ListOrdered size={18} />
                <span className="text-[10px]">Ordered</span>
              </MoreToolBtn>
              <MoreToolBtn onClick={() => { editor.chain().focus().toggleTaskList().run(); setMoreOpen(false) }} active={editor.isActive("taskList")} title="Task List">
                <CheckSquare size={18} />
                <span className="text-[10px]">Tasks</span>
              </MoreToolBtn>

              <MoreToolBtn onClick={() => { editor.chain().focus().toggleHeading({ level: 1 }).run(); setMoreOpen(false) }} active={editor.isActive("heading", { level: 1 })} title="Heading 1">
                <Heading1 size={18} />
                <span className="text-[10px]">H1</span>
              </MoreToolBtn>
              <MoreToolBtn onClick={() => { editor.chain().focus().toggleHeading({ level: 2 }).run(); setMoreOpen(false) }} active={editor.isActive("heading", { level: 2 })} title="Heading 2">
                <Heading2 size={18} />
                <span className="text-[10px]">H2</span>
              </MoreToolBtn>
              <MoreToolBtn onClick={() => { editor.chain().focus().toggleHeading({ level: 3 }).run(); setMoreOpen(false) }} active={editor.isActive("heading", { level: 3 })} title="Heading 3">
                <Heading3 size={18} />
                <span className="text-[10px]">H3</span>
              </MoreToolBtn>
              <MoreToolBtn onClick={() => { editor.chain().focus().toggleHeading({ level: 4 }).run(); setMoreOpen(false) }} active={editor.isActive("heading", { level: 4 })} title="Heading 4">
                <Heading4 size={18} />
                <span className="text-[10px]">H4</span>
              </MoreToolBtn>
              <MoreToolBtn onClick={() => { editor.chain().focus().toggleCodeBlock().run(); setMoreOpen(false) }} active={editor.isActive("codeBlock")} title="Code Block">
                <Code2 size={18} />
                <span className="text-[10px]">Code</span>
              </MoreToolBtn>

              <MoreToolBtn onClick={() => { editor.chain().focus().setTextAlign("left").run(); setMoreOpen(false) }} active={editor.isActive({ textAlign: "left" })} title="Align Left">
                <AlignLeft size={18} />
                <span className="text-[10px]">Left</span>
              </MoreToolBtn>
              <MoreToolBtn onClick={() => { editor.chain().focus().setTextAlign("center").run(); setMoreOpen(false) }} active={editor.isActive({ textAlign: "center" })} title="Center">
                <AlignCenter size={18} />
                <span className="text-[10px]">Center</span>
              </MoreToolBtn>
              <MoreToolBtn onClick={() => { editor.chain().focus().setTextAlign("right").run(); setMoreOpen(false) }} active={editor.isActive({ textAlign: "right" })} title="Align Right">
                <AlignRight size={18} />
                <span className="text-[10px]">Right</span>
              </MoreToolBtn>
              <MoreToolBtn onClick={() => { editor.chain().focus().toggleSuperscript().run(); setMoreOpen(false) }} active={editor.isActive("superscript")} title="Superscript">
                <Superscript size={18} />
                <span className="text-[10px]">Super</span>
              </MoreToolBtn>
              <MoreToolBtn onClick={() => { editor.chain().focus().toggleSubscript().run(); setMoreOpen(false) }} active={editor.isActive("subscript")} title="Subscript">
                <Subscript size={18} />
                <span className="text-[10px]">Sub</span>
              </MoreToolBtn>

              <MoreToolBtn onClick={insertHR} title="Divider">
                <Minus size={18} />
                <span className="text-[10px]">HR</span>
              </MoreToolBtn>
              <MoreToolBtn onClick={() => insertMath(false)} title="Inline Math">
                <FunctionSquare size={18} />
                <span className="text-[10px]">Math</span>
              </MoreToolBtn>
              <MoreToolBtn onClick={() => insertMath(true)} title="Block Math">
                <span className="text-sm font-mono">Σ</span>
                <span className="text-[10px]">Eq</span>
              </MoreToolBtn>
              <MoreToolBtn onClick={() => { editor.chain().focus().insertContent({ type: "paragraph" }).run(); setMoreOpen(false) }} title="Paragraph">
                <span className="text-sm font-mono leading-none">P</span>
                <span className="text-[10px]">Para</span>
              </MoreToolBtn>
              <MoreToolBtn onClick={insertPageBreak} title="Page Break">
                <SeparatorHorizontal size={18} />
                <span className="text-[10px]">Break</span>
              </MoreToolBtn>

              <MoreToolBtn onClick={() => { editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(); setMoreOpen(false) }} title="Table">
                <Table size={18} />
                <span className="text-[10px]">Table</span>
              </MoreToolBtn>
              <MoreToolBtn onClick={() => { insertCallout("note"); setMoreOpen(false) }} title="Callout">
                <AlertCircle size={18} />
                <span className="text-[10px]">Note</span>
              </MoreToolBtn>
              <MoreToolBtn onClick={insertDetails} title="Collapse">
                <ChevronDown size={18} />
                <span className="text-[10px]">Fold</span>
              </MoreToolBtn>
              <MoreToolBtn onClick={insertMermaid} title="Mermaid">
                <Code2 size={18} />
                <span className="text-[10px]">Merm.</span>
              </MoreToolBtn>
              <MoreToolBtn onClick={() => { setMoreOpen(false); onToggleEditType() }} active={editType === "markdown"} title="Source Mode">
                <FileCode2 size={18} />
                <span className="text-[10px]">Source</span>
              </MoreToolBtn>

              {/* Inline color swatches */}
              <div className="col-span-5 mt-1">
                <p className="mb-1.5 text-[10px] font-medium text-[--color-text-muted] uppercase tracking-wider">Text Color</p>
                <div className="flex flex-wrap gap-1.5">
                  {TEXT_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().setColor(color).run(); setMoreOpen(false) }}
                      className="h-6 w-6 rounded-full border border-[--color-border] transition-transform active:scale-110"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
              <div className="col-span-5 mt-1">
                <p className="mb-1.5 text-[10px] font-medium text-[--color-text-muted] uppercase tracking-wider">Highlight</p>
                <div className="flex flex-wrap gap-1.5">
                  {HIGHLIGHT_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleHighlight({ color }).run(); setMoreOpen(false) }}
                      className="h-6 w-6 rounded-full border border-[--color-border] transition-transform active:scale-110"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                  <button
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().unsetHighlight().run(); setMoreOpen(false) }}
                    className="h-6 w-6 rounded-full border border-[--color-border] flex items-center justify-center bg-white"
                    title="No highlight"
                  >
                    <X size={10} className="text-[--color-text-muted]" />
                  </button>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setMoreOpen(false)}
              className="mt-4 w-full rounded-full border border-[--color-border] py-2 text-sm text-[--color-text-muted] hover:bg-[--color-bg-hover]"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Link dialog */}
      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Insert Link</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs text-[--color-text-muted]">URL</label>
              <input
                value={linkHref}
                onChange={(e) => setLinkHref(e.target.value)}
                placeholder="https://"
                className="h-9 w-full rounded-[--radius-sm] border border-[--color-border-strong] bg-[--color-bg-surface] px-3 text-sm outline-none focus:border-[--color-text-primary]"
                onKeyDown={(e) => e.key === "Enter" && handleLinkInsert()}
                autoFocus
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-[--color-text-muted]">Text</label>
              <input
                value={linkText}
                onChange={(e) => setLinkText(e.target.value)}
                placeholder="Leave empty to use selected text"
                className="h-9 w-full rounded-[--radius-sm] border border-[--color-border-strong] bg-[--color-bg-surface] px-3 text-sm outline-none focus:border-[--color-text-primary]"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleLinkInsert}
                className="h-9 flex-1 rounded-[--radius-sm] bg-[--color-text-primary] text-sm text-white"
              >
                Confirm
              </button>
              {editor.isActive("link") && (
                <button
                  type="button"
                  onClick={() => { editor.chain().focus().unsetLink().run(); setLinkOpen(false) }}
                  className="h-9 rounded-[--radius-sm] border border-[--color-border] px-3 text-sm hover:bg-[--color-bg-hover]"
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Image dialog */}
      <Dialog open={imageOpen} onOpenChange={setImageOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Insert Image</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div
              className="cursor-pointer rounded-[--radius-md] border-2 border-dashed border-[--color-border-strong] p-6 text-center hover:border-[--color-text-muted] transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <ImageIcon size={28} className="mx-auto mb-2 text-[--color-text-muted]" />
              <p className="text-sm text-[--color-text-secondary]">
                {imageUploading ? "Uploading..." : "Tap to upload"}
              </p>
              <p className="mt-1 text-xs text-[--color-text-muted]">PNG, JPEG, WebP, GIF, max 5MB</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f) }}
            />
            <div className="flex items-center gap-2">
              <div className="flex-1 border-t border-[--color-border]" />
              <span className="text-xs text-[--color-text-muted]">or URL</span>
              <div className="flex-1 border-t border-[--color-border]" />
            </div>
            <div className="flex gap-2">
              <input
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://example.com/image.png"
                className="h-9 flex-1 rounded-[--radius-sm] border border-[--color-border-strong] bg-[--color-bg-surface] px-3 text-sm outline-none focus:border-[--color-text-primary]"
                onKeyDown={(e) => e.key === "Enter" && imageUrl.trim() && insertImage(imageUrl.trim())}
              />
              <button
                type="button"
                onClick={() => imageUrl.trim() && insertImage(imageUrl.trim())}
                disabled={!imageUrl.trim()}
                className="h-9 rounded-[--radius-sm] bg-[--color-text-primary] px-4 text-sm text-white disabled:opacity-40"
              >
                Insert
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
