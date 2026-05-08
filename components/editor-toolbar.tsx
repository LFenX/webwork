"use client"

import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import type { Editor } from "@tiptap/react"
import {
  Bold,
  Bookmark,
  CheckSquare,
  ChevronDown,
  Code,
  Code2,
  Command,
  FileCode2,
  FolderOpen,
  GitGraph,
  Heading1,
  Heading2,
  Heading3,
  Highlighter,
  Image as ImageIcon,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  MoreHorizontal,
  Plus,
  Quote,
  Redo2,
  Settings2,
  Strikethrough,
  Table,
  Type,
  Underline,
  Undo2,
} from "lucide-react"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ALLOWED_MIME, UPLOAD_ERROR_MESSAGES } from "@/lib/upload"
import { TABLE_VARIANTS, type TableVariant } from "@/components/editor/table-variants"

interface EditorToolbarProps {
  editor: Editor | null
  postId?: string
  onOpenImageManager: () => void
  editType: "wysiwyg" | "markdown"
  onToggleEditType: () => void
}

type MenuId = "style" | "insert" | "color" | "settings" | null

const MOBILE_MENU_SELECTION_META = "mobile-menu-selection"

const TEXT_COLORS = [
  "#1A1A1A",
  "#6B7280",
  "#DC2626",
  "#EA580C",
  "#CA8A04",
  "#16A34A",
  "#2563EB",
  "#7C3AED",
]

const HIGHLIGHT_COLORS = [
  "#FEF3C7",
  "#FEE2E2",
  "#DBEAFE",
  "#DCFCE7",
  "#F3E8FF",
  "#F1F5F9",
]

function isTextEntryElement(el: Element | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  if (el.isContentEditable) return true
  if (el instanceof HTMLTextAreaElement) return true
  if (el instanceof HTMLInputElement) {
    const nonText = ["button", "checkbox", "file", "radio", "range", "reset", "submit", "color"]
    return !nonText.includes(el.type)
  }
  return false
}

function isActiveBlock(editor: Editor | null, value: string) {
  if (!editor) return false
  if (value === "paragraph") return editor.isActive("paragraph")
  if (value.startsWith("h")) return editor.isActive("heading", { level: Number(value.slice(1)) })
  return editor.isActive(value)
}

function currentBlockLabel(editor: Editor | null) {
  if (!editor) return "正文"
  if (editor.isActive("heading", { level: 1 })) return "标题 1"
  if (editor.isActive("heading", { level: 2 })) return "标题 2"
  if (editor.isActive("heading", { level: 3 })) return "标题 3"
  if (editor.isActive("bulletList")) return "项目列表"
  if (editor.isActive("orderedList")) return "编号列表"
  if (editor.isActive("taskList")) return "待办"
  if (editor.isActive("blockquote")) return "引用"
  if (editor.isActive("codeBlock")) return "代码块"
  return "正文"
}

function IconButton({
  onClick,
  active,
  disabled,
  title,
  children,
}: {
  onClick?: () => void
  active?: boolean
  disabled?: boolean
  title: string
  children: React.ReactNode
}) {
  function activate(event: React.MouseEvent | React.TouchEvent) {
    event.preventDefault()
    event.stopPropagation()
    onClick?.()
  }

  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onMouseDown={activate}
      onTouchStart={activate}
      onTouchEnd={(event) => {
        event.preventDefault()
        event.stopPropagation()
      }}
      className={`notion-editor-tool ${active ? "is-active" : ""}`}
    >
      {children}
    </button>
  )
}

function MenuButton({
  open,
  label,
  icon,
  onClick,
}: {
  open: boolean
  label: string
  icon: React.ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onMouseDown={(event) => {
        event.preventDefault()
        onClick()
      }}
      className={`notion-editor-menu-button ${open ? "is-active" : ""}`}
    >
      {icon}
      <span>{label}</span>
      <ChevronDown size={13} />
    </button>
  )
}

function MenuPanel({
  children,
  onClose,
  wide,
  mobileSheet,
}: {
  children: React.ReactNode
  onClose: () => void
  wide?: boolean
  mobileSheet?: boolean
}) {
  const panel = (
    <div className={`notion-editor-menu-panel ${wide ? "is-wide" : ""} ${mobileSheet ? "is-mobile-sheet" : ""}`}>
      {children}
    </div>
  )

  if (mobileSheet) {
    const portalRoot = typeof document === "undefined" ? null : document.body
    return portalRoot ? createPortal(panel, portalRoot) : panel
  }

  const content = (
    <>
      <button type="button" aria-label="关闭菜单" className="notion-editor-menu-backdrop" onClick={onClose} />
      {panel}
    </>
  )
  return content
}

function LinkDialog({ editor }: { editor: Editor | null }) {
  const [open, setOpen] = useState(false)
  const [href, setHref] = useState("")
  const [text, setText] = useState("")

  function openDialog() {
    const existing = editor?.getAttributes("link").href as string | undefined
    const selection = editor?.state.selection
    setHref(existing ?? "")
    setText(selection ? editor?.state.doc.textBetween(selection.from, selection.to) ?? "" : "")
    setOpen(true)
  }

  function apply() {
    const url = href.trim()
    if (!url) {
      editor?.chain().focus().extendMarkRange("link").unsetLink().run()
      setOpen(false)
      return
    }

    if (text.trim()) {
      editor?.chain().focus().insertContent(`<a href="${url}">${text.trim()}</a>`).run()
    } else {
      editor?.chain().focus().extendMarkRange("link").setLink({ href: url }).run()
    }
    setOpen(false)
  }

  return (
    <>
      <IconButton onClick={openDialog} active={editor?.isActive("link")} disabled={!editor} title="链接">
        <Link2 size={15} />
      </IconButton>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>插入链接</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <label className="grid gap-1.5 text-sm">
              <span className="text-xs text-[--color-text-muted]">链接地址</span>
              <input
                value={href}
                onChange={(event) => setHref(event.target.value)}
                placeholder="https://"
                className="notion-dialog-input"
                onKeyDown={(event) => event.key === "Enter" && apply()}
                autoFocus
              />
            </label>
            <label className="grid gap-1.5 text-sm">
              <span className="text-xs text-[--color-text-muted]">显示文字</span>
              <input
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder="留空则使用选中文字"
                className="notion-dialog-input"
                onKeyDown={(event) => event.key === "Enter" && apply()}
              />
            </label>
            <div className="flex gap-2">
              <button type="button" onClick={apply} className="notion-dialog-primary">确认</button>
              {editor?.isActive("link") && (
                <button
                  type="button"
                  onClick={() => {
                    editor.chain().focus().unsetLink().run()
                    setOpen(false)
                  }}
                  className="notion-dialog-secondary"
                >
                  移除
                </button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

function ImageInsertDialog({ editor, postId }: { editor: Editor | null; postId?: string }) {
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState("")
  const [alt, setAlt] = useState("")
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function insertImage(src: string, fallbackAlt?: string) {
    editor?.chain().focus().setImage({ src, alt: alt || fallbackAlt || undefined }).run()
    setUrl("")
    setAlt("")
    setOpen(false)
  }

  async function uploadFile(file: File) {
    if (!ALLOWED_MIME.has(file.type)) {
      toast.error(UPLOAD_ERROR_MESSAGES.invalid_mime)
      return
    }

    setUploading(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      if (postId) fd.append("postId", postId)
      const res = await fetch("/api/upload", { method: "POST", body: fd })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error(UPLOAD_ERROR_MESSAGES[err.error as string] ?? "上传失败")
        return
      }
      const { url: uploadedUrl, originalName } = await res.json()
      insertImage(uploadedUrl, originalName)
      toast.success("图片已插入")
    } finally {
      setUploading(false)
    }
  }

  return (
    <>
      <IconButton onClick={() => setOpen(true)} disabled={!editor} title="图片">
        <ImageIcon size={15} />
      </IconButton>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>插入图片</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="notion-upload-zone"
              disabled={uploading}
            >
              <ImageIcon size={22} />
              <span>{uploading ? "上传中..." : "选择图片或拖到编辑区直接上传"}</span>
              <small>PNG、JPG、WebP、GIF，最大 5 MB</small>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) void uploadFile(file)
              }}
            />
            <label className="grid gap-1.5 text-sm">
              <span className="text-xs text-[--color-text-muted]">图片 URL</span>
              <input
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://example.com/image.png"
                className="notion-dialog-input"
              />
            </label>
            <label className="grid gap-1.5 text-sm">
              <span className="text-xs text-[--color-text-muted]">替代说明</span>
              <input
                value={alt}
                onChange={(event) => setAlt(event.target.value)}
                placeholder="可选"
                className="notion-dialog-input"
              />
            </label>
            <button
              type="button"
              onClick={() => url.trim() && insertImage(url.trim())}
              disabled={!url.trim()}
              className="notion-dialog-primary w-full"
            >
              插入 URL 图片
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

function TableDialog({ editor }: { editor: Editor | null }) {
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState(3)
  const [cols, setCols] = useState(3)
  const [variant, setVariant] = useState<TableVariant>("default")

  function insert() {
    editor?.chain().focus().insertTable({ rows, cols, withHeaderRow: true }).updateAttributes("table", { variant }).run()
    setOpen(false)
  }

  return (
    <>
      <IconButton onClick={() => setOpen(true)} disabled={!editor} title="表格">
        <Table size={15} />
      </IconButton>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>插入表格</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-1.5 text-sm">
                <span className="text-xs text-[--color-text-muted]">行数</span>
                <input type="number" min={1} max={20} value={rows} onChange={(event) => setRows(Number(event.target.value))} className="notion-dialog-input" />
              </label>
              <label className="grid gap-1.5 text-sm">
                <span className="text-xs text-[--color-text-muted]">列数</span>
                <input type="number" min={1} max={10} value={cols} onChange={(event) => setCols(Number(event.target.value))} className="notion-dialog-input" />
              </label>
            </div>
            <label className="grid gap-1.5 text-sm">
              <span className="text-xs text-[--color-text-muted]">样式</span>
              <select value={variant} onChange={(event) => setVariant(event.target.value as TableVariant)} className="notion-dialog-input">
                {TABLE_VARIANTS.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
            </label>
            <button type="button" onClick={insert} className="notion-dialog-primary w-full">
              插入 {rows} x {cols} 表格
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

function MobileBigButton({
  onClick,
  active,
  disabled,
  title,
  children,
}: {
  onClick?: () => void
  active?: boolean
  disabled?: boolean
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onMouseDown={(event) => { event.preventDefault(); event.stopPropagation(); onClick?.() }}
      onTouchStart={(event) => { event.preventDefault(); event.stopPropagation(); onClick?.() }}
      onTouchEnd={(event) => { event.preventDefault(); event.stopPropagation() }}
      className={`notion-mobile-tool ${active ? "is-active" : ""}`}
    >
      {children}
    </button>
  )
}

function useIsMobileViewport() {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)")
    const handler = (event: MediaQueryListEvent | MediaQueryList) => setIsMobile("matches" in event ? event.matches : false)
    handler(mq)
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [])
  return isMobile
}

export function EditorToolbar({
  editor,
  postId,
  onOpenImageManager,
  editType,
  onToggleEditType,
}: EditorToolbarProps) {
  const [openMenu, setOpenMenu] = useState<MenuId>(null)
  const isMobile = useIsMobileViewport()

  useEffect(() => {
    if (!isMobile || !openMenu) return
    document.body.classList.add("mobile-editor-menu-open")
    return () => document.body.classList.remove("mobile-editor-menu-open")
  }, [isMobile, openMenu])

  function setPreservedSelection(enabled: boolean) {
    if (!editor) return
    const selection = editor.state.selection
    const range = enabled && !selection.empty ? { from: selection.from, to: selection.to } : null
    editor.view.dispatch(editor.state.tr.setMeta(MOBILE_MENU_SELECTION_META, range))
  }

  function closeMenu() {
    setOpenMenu(null)
    setPreservedSelection(false)
  }

  function restoreScrollPosition(scrollX: number, scrollY: number) {
    if (typeof window === "undefined") return
    const restore = () => window.scrollTo(scrollX, scrollY)
    window.requestAnimationFrame(restore)
    window.setTimeout(restore, 80)
  }

  function runStableEditorAction(action: () => void, options: { closeMenu?: boolean } = {}) {
    const scrollX = typeof window === "undefined" ? 0 : window.scrollX
    const scrollY = typeof window === "undefined" ? 0 : window.scrollY
    action()
    restoreScrollPosition(scrollX, scrollY)
    if (options.closeMenu) closeMenu()
  }

  function dismissSoftKeyboard() {
    if (typeof window === "undefined" || typeof document === "undefined") return
    const hadTextFocus = isTextEntryElement(document.activeElement)
    try { editor?.view.dom.blur() } catch { /* ignore */ }
    try { editor?.commands.blur() } catch { /* ignore */ }
    const active = document.activeElement
    if (active instanceof HTMLElement && active !== document.body) {
      try { active.blur() } catch { /* ignore */ }
    }
    if (hadTextFocus) {
      const shim = document.createElement("input")
      shim.readOnly = true
      shim.setAttribute("aria-hidden", "true")
      shim.style.position = "fixed"
      shim.style.top = "0"
      shim.style.left = "0"
      shim.style.width = "1px"
      shim.style.height = "1px"
      shim.style.opacity = "0"
      shim.style.pointerEvents = "none"
      document.body.appendChild(shim)
      try { shim.focus({ preventScroll: true }) } catch { shim.focus() }
      window.requestAnimationFrame(() => {
        try { shim.blur() } catch { /* ignore */ }
        shim.remove()
      })
    }
  }

  function readKbdBottomPx(): number {
    if (typeof window === "undefined") return 0
    const v = getComputedStyle(document.documentElement).getPropertyValue("--kbd-bottom")
    return parseFloat(v || "0") || 0
  }

  function readVisualKeyboardGapPx(): number {
    if (typeof window === "undefined") return 0
    const viewport = window.visualViewport
    if (viewport) {
      return Math.max(0, Math.round(window.innerHeight - (viewport.height + viewport.offsetTop)))
    }
    const cssGap = getComputedStyle(document.documentElement).getPropertyValue("--visual-keyboard-gap")
    return parseFloat(cssGap || "0") || 0
  }

  function snapshotKeyboardHeight() {
    if (typeof window === "undefined") return
    const root = document.documentElement
    const cs = getComputedStyle(root)
    const live = parseFloat(cs.getPropertyValue("--kbd-bottom") || "0") || 0
    const visualGap = parseFloat(cs.getPropertyValue("--visual-keyboard-gap") || "0") || 0
    const cached = parseFloat(cs.getPropertyValue("--menu-sheet-height") || "0") || 0
    const maxSheet = Math.max(300, Math.round(window.innerHeight * 0.72))
    const next = Math.min(Math.max(live, visualGap, cached, 300), maxSheet)
    root.style.setProperty("--menu-sheet-height", `${next}px`)
  }

  async function awaitKeyboardClose(maxWaitMs = 700, minWaitMs = 280): Promise<void> {
    if (typeof window === "undefined") return
    await new Promise<void>((resolve) => window.setTimeout(resolve, minWaitMs))
    if (readVisualKeyboardGapPx() < 80) return
    return new Promise<void>((resolve) => {
      let done = false
      const finish = () => {
        if (done) return
        done = true
        window.visualViewport?.removeEventListener("resize", onResize)
        window.visualViewport?.removeEventListener("scroll", onResize)
        window.removeEventListener("resize", onResize)
        window.clearTimeout(timeoutId)
        resolve()
      }
      const onResize = () => {
        window.requestAnimationFrame(() => { if (readVisualKeyboardGapPx() < 80) finish() })
      }
      window.visualViewport?.addEventListener("resize", onResize)
      window.visualViewport?.addEventListener("scroll", onResize)
      window.addEventListener("resize", onResize)
      const timeoutId = window.setTimeout(finish, Math.max(0, maxWaitMs - minWaitMs))
    })
  }

  function toggleMenu(menu: Exclude<MenuId, null>) {
    // Close the same menu
    if (openMenu === menu) {
      closeMenu()
      return
    }
    // Switch between menus — keyboard is already gone, no wait
    if (openMenu) {
      setPreservedSelection(true)
      setOpenMenu(menu)
      return
    }
    const isMobileNow = typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches
    if (!isMobileNow) {
      setPreservedSelection(true)
      setOpenMenu(menu)
      return
    }
    // Mobile first-open: cache the current keyboard height (so the sheet matches it),
    // then if the keyboard is up, dismiss and wait for visualViewport.resize to confirm
    // before rendering the panel — this prevents the panel from briefly racing the keyboard.
    snapshotKeyboardHeight()
    setPreservedSelection(true)
    const keyboardLikelyOpen = readKbdBottomPx() > 0 || readVisualKeyboardGapPx() >= 80 || isTextEntryElement(document.activeElement)
    if (!keyboardLikelyOpen) {
      setOpenMenu(menu)
      return
    }
    // Defer to next macrotask so the active touch sequence (prevent-defaulted) finishes first;
    // iOS Safari is more reliable about dismissing the keyboard from outside the touch handler.
    window.setTimeout(() => {
      dismissSoftKeyboard()
      awaitKeyboardClose().then(() => setOpenMenu(menu))
    }, 0)
  }

  function setBlock(value: string) {
    if (!editor) return
    runStableEditorAction(() => {
      const chain = editor.chain().focus()
      if (value === "paragraph") chain.setParagraph().run()
      else if (value === "h1") chain.toggleHeading({ level: 1 }).run()
      else if (value === "h2") chain.toggleHeading({ level: 2 }).run()
      else if (value === "h3") chain.toggleHeading({ level: 3 }).run()
      else if (value === "bulletList") chain.toggleBulletList().run()
      else if (value === "orderedList") chain.toggleOrderedList().run()
      else if (value === "taskList") chain.toggleTaskList().run()
      else if (value === "blockquote") chain.toggleBlockquote().run()
      else if (value === "codeBlock") chain.toggleCodeBlock().run()
    }, { closeMenu: true })
  }

  function insertBlock(value: string) {
    if (!editor) return
    runStableEditorAction(() => {
      const chain = editor.chain().focus()
      if (value === "divider") chain.insertContent({ type: "horizontalRule", attrs: { variant: "default" } }).run()
      if (value === "inlineMath") chain.insertContent({ type: "inlineMath", attrs: { formula: "x^2" } }).run()
      if (value === "blockMath") chain.insertContent({ type: "blockMath", attrs: { formula: "E = mc^2" } }).run()
      if (value === "callout") {
      chain.insertContent({
        type: "callout",
        attrs: { type: "note" },
        content: [{ type: "paragraph", content: [{ type: "text", text: "提示内容" }] }],
      }).run()
    }
      if (value === "details") {
      chain.insertContent({
        type: "details",
        attrs: { open: true, summary: "点击展开" },
        content: [{ type: "paragraph", content: [{ type: "text", text: "在这里输入内容..." }] }],
      }).run()
    }
      if (value === "pageBreak") chain.insertContent({ type: "pageBreak" }).run()
      if (value === "mermaid") {
      chain.insertContent({
        type: "codeBlock",
        attrs: { language: "mermaid", theme: "default" },
        content: [{ type: "text", text: "graph TD\n  A[开始] --> B{条件}\n  B -->|是| C[结果1]\n  B -->|否| D[结果2]" }],
      }).run()
    }
      if (value === "kbd") chain.insertContent("<kbd>Ctrl</kbd> + <kbd>K</kbd>").run()
      if (value === "bookmark") {
      chain.insertContent('<a class="notion-bookmark" href="https://example.com" data-bookmark="true">https://example.com</a>').run()
    }
    }, { closeMenu: true })
  }

  if (editType === "markdown") {
    return (
      <div className="notion-editor-toolbar">
        <div className="notion-editor-toolbar-scroll">
          <button type="button" onMouseDown={(event) => { event.preventDefault(); onToggleEditType() }} className="notion-editor-source-pill">
            <FileCode2 size={15} />
            返回可视编辑
          </button>
          <span className="notion-editor-toolbar-hint">Markdown 源码模式</span>
          <button type="button" onMouseDown={(event) => { event.preventDefault(); onOpenImageManager() }} className="notion-editor-menu-button ml-auto">
            <FolderOpen size={15} />
            素材
          </button>
        </div>
      </div>
    )
  }

  if (isMobile) {
    return (
      <div className={`notion-editor-toolbar notion-editor-toolbar-mobile ${openMenu ? "is-menu-open" : ""}`}>
        <div className="notion-mobile-toolbar-grid">
          <MobileBigButton title="样式" active={openMenu === "style"} onClick={() => toggleMenu("style")}>
            <Type size={22} />
          </MobileBigButton>
          <MobileBigButton title="图片" onClick={() => toggleMenu("settings")}>
            <ImageIcon size={22} />
          </MobileBigButton>
          <MobileBigButton title="插入" active={openMenu === "insert"} onClick={() => toggleMenu("insert")}>
            <Plus size={22} />
          </MobileBigButton>
          <MobileBigButton title="撤销" disabled={!editor?.can().undo()} onClick={() => runStableEditorAction(() => editor?.chain().focus().undo().run())}>
            <Undo2 size={22} />
          </MobileBigButton>
          <MobileBigButton title="重做" disabled={!editor?.can().redo()} onClick={() => runStableEditorAction(() => editor?.chain().focus().redo().run())}>
            <Redo2 size={22} />
          </MobileBigButton>
          <MobileBigButton title="更多" active={openMenu === "color"} onClick={() => toggleMenu("color")}>
            <Settings2 size={22} />
          </MobileBigButton>
        </div>

        {openMenu === "style" && (
          <MenuPanel onClose={closeMenu} mobileSheet>
            <div className="notion-mobile-sheet-grid">
              {[
                ["paragraph", "正文", Type],
                ["h1", "标题 1", Heading1],
                ["h2", "标题 2", Heading2],
                ["h3", "标题 3", Heading3],
                ["bulletList", "项目列表", List],
                ["orderedList", "编号列表", ListOrdered],
                ["taskList", "待办", CheckSquare],
                ["blockquote", "引用", Quote],
                ["codeBlock", "代码块", Code2],
              ].map(([value, label, Icon]) => (
                <button
                  key={value as string}
                  type="button"
                  onMouseDown={(event) => { event.preventDefault(); setBlock(value as string) }}
                  className={`notion-mobile-sheet-tile ${isActiveBlock(editor, value as string) ? "is-active" : ""}`}
                >
                  <Icon size={18} />
                  <span>{label as string}</span>
                </button>
              ))}
            </div>
            <div className="notion-mobile-sheet-divider" />
            <div className="notion-mobile-inline-row">
              <button type="button" onMouseDown={(e) => { e.preventDefault(); runStableEditorAction(() => editor?.chain().focus().toggleBold().run()) }} className={`notion-mobile-inline-btn ${editor?.isActive("bold") ? "is-active" : ""}`}><Bold size={16}/></button>
              <button type="button" onMouseDown={(e) => { e.preventDefault(); runStableEditorAction(() => editor?.chain().focus().toggleItalic().run()) }} className={`notion-mobile-inline-btn ${editor?.isActive("italic") ? "is-active" : ""}`}><Italic size={16}/></button>
              <button type="button" onMouseDown={(e) => { e.preventDefault(); runStableEditorAction(() => editor?.chain().focus().toggleUnderline().run()) }} className={`notion-mobile-inline-btn ${editor?.isActive("underline") ? "is-active" : ""}`}><Underline size={16}/></button>
              <button type="button" onMouseDown={(e) => { e.preventDefault(); runStableEditorAction(() => editor?.chain().focus().toggleStrike().run()) }} className={`notion-mobile-inline-btn ${editor?.isActive("strike") ? "is-active" : ""}`}><Strikethrough size={16}/></button>
              <button type="button" onMouseDown={(e) => { e.preventDefault(); runStableEditorAction(() => editor?.chain().focus().toggleCode().run()) }} className={`notion-mobile-inline-btn ${editor?.isActive("code") ? "is-active" : ""}`}><Code size={16}/></button>
            </div>
          </MenuPanel>
        )}

        {openMenu === "insert" && (
          <MenuPanel onClose={closeMenu} mobileSheet>
            <div className="notion-mobile-dialog-row">
              <div className="notion-mobile-dialog-tile" aria-label="链接"><LinkDialog editor={editor} /><span>链接</span></div>
              <div className="notion-mobile-dialog-tile" aria-label="图片"><ImageInsertDialog editor={editor} postId={postId} /><span>图片</span></div>
              <div className="notion-mobile-dialog-tile" aria-label="表格"><TableDialog editor={editor} /><span>表格</span></div>
            </div>
            <div className="notion-mobile-sheet-divider" />
            <div className="notion-mobile-sheet-grid">
              {[
                ["divider", "分割线", Minus],
                ["inlineMath", "行内公式", Code],
                ["blockMath", "块级公式", Code2],
                ["callout", "提示块", Quote],
                ["details", "折叠块", ChevronDown],
                ["mermaid", "Mermaid 图", GitGraph],
                ["kbd", "键盘按键", Command],
                ["bookmark", "书签卡片", Bookmark],
                ["pageBreak", "分页符", FileCode2],
              ].map(([value, label, Icon]) => (
                <button
                  key={value as string}
                  type="button"
                  onMouseDown={(event) => { event.preventDefault(); insertBlock(value as string) }}
                  className="notion-mobile-sheet-tile"
                >
                  <Icon size={18} />
                  <span>{label as string}</span>
                </button>
              ))}
            </div>
          </MenuPanel>
        )}

        {openMenu === "color" && (
          <MenuPanel onClose={closeMenu} wide mobileSheet>
            <div className="notion-color-section">
              <span>文字</span>
              <div className="notion-color-grid">
                {TEXT_COLORS.map((color) => (
                  <button key={color} type="button" title={color} className="notion-color-swatch" style={{ backgroundColor: color }} onMouseDown={(event) => { event.preventDefault(); runStableEditorAction(() => editor?.chain().focus().setColor(color).run(), { closeMenu: true }) }} />
                ))}
              </div>
            </div>
            <div className="notion-color-section">
              <span>背景</span>
              <div className="notion-color-grid">
                {HIGHLIGHT_COLORS.map((color) => (
                  <button key={color} type="button" title={color} className="notion-color-swatch" style={{ backgroundColor: color }} onMouseDown={(event) => { event.preventDefault(); runStableEditorAction(() => editor?.chain().focus().toggleHighlight({ color }).run(), { closeMenu: true }) }} />
                ))}
              </div>
            </div>
            <div className="notion-mobile-sheet-divider" />
            <div className="notion-mobile-action-row">
              <button type="button" onMouseDown={(event) => { event.preventDefault(); onToggleEditType(); closeMenu() }} className="notion-editor-source-pill">
                <FileCode2 size={15} /> 源码
              </button>
              <button type="button" onMouseDown={(event) => { event.preventDefault(); onOpenImageManager(); closeMenu() }} className="notion-editor-menu-button">
                <FolderOpen size={15} /> 素材
              </button>
            </div>
          </MenuPanel>
        )}

        {openMenu === "settings" && (
          <MenuPanel onClose={closeMenu} mobileSheet>
            <div className="notion-mobile-dialog-row">
              <div className="notion-mobile-dialog-tile" aria-label="图片"><ImageInsertDialog editor={editor} postId={postId} /><span>图片</span></div>
            </div>
            <div className="notion-mobile-sheet-divider" />
            <button type="button" onMouseDown={(event) => { event.preventDefault(); onOpenImageManager(); closeMenu() }} className="notion-mobile-sheet-tile">
              <FolderOpen size={18} />
              <span>素材</span>
            </button>
          </MenuPanel>
        )}
      </div>
    )
  }

  return (
    <div className="notion-editor-toolbar">
      <div className="notion-editor-toolbar-scroll">
        <IconButton onClick={() => runStableEditorAction(() => editor?.chain().focus().undo().run())} disabled={!editor?.can().undo()} title="撤销">
          <Undo2 size={15} />
        </IconButton>
        <IconButton onClick={() => runStableEditorAction(() => editor?.chain().focus().redo().run())} disabled={!editor?.can().redo()} title="重做">
          <Redo2 size={15} />
        </IconButton>
        <div className="notion-editor-separator" />

        <div className="notion-editor-menu">
          <MenuButton open={openMenu === "style"} label={currentBlockLabel(editor)} icon={<Type size={15} />} onClick={() => toggleMenu("style")} />
          {openMenu === "style" && (
            <MenuPanel onClose={closeMenu}>
              {[
                ["paragraph", "正文", Type],
                ["h1", "标题 1", Heading1],
                ["h2", "标题 2", Heading2],
                ["h3", "标题 3", Heading3],
                ["bulletList", "项目列表", List],
                ["orderedList", "编号列表", ListOrdered],
                ["taskList", "待办", CheckSquare],
                ["blockquote", "引用", Quote],
                ["codeBlock", "代码块", Code2],
              ].map(([value, label, Icon]) => (
                <button key={value as string} type="button" onMouseDown={(event) => { event.preventDefault(); setBlock(value as string) }} className={`notion-editor-menu-row ${isActiveBlock(editor, value as string) ? "is-active" : ""}`}>
                  <Icon size={15} />
                  <span>{label as string}</span>
                </button>
              ))}
            </MenuPanel>
          )}
        </div>

        <IconButton onClick={() => runStableEditorAction(() => editor?.chain().focus().toggleBold().run())} active={editor?.isActive("bold")} title="加粗">
          <Bold size={15} />
        </IconButton>
        <IconButton onClick={() => runStableEditorAction(() => editor?.chain().focus().toggleItalic().run())} active={editor?.isActive("italic")} title="斜体">
          <Italic size={15} />
        </IconButton>
        <IconButton onClick={() => runStableEditorAction(() => editor?.chain().focus().toggleUnderline().run())} active={editor?.isActive("underline")} title="下划线">
          <Underline size={15} />
        </IconButton>
        <IconButton onClick={() => runStableEditorAction(() => editor?.chain().focus().toggleStrike().run())} active={editor?.isActive("strike")} title="删除线">
          <Strikethrough size={15} />
        </IconButton>
        <IconButton onClick={() => runStableEditorAction(() => editor?.chain().focus().toggleCode().run())} active={editor?.isActive("code")} title="行内代码">
          <Code size={15} />
        </IconButton>

        <div className="notion-editor-separator" />
        <LinkDialog editor={editor} />
        <ImageInsertDialog editor={editor} postId={postId} />
        <TableDialog editor={editor} />

        <div className="notion-editor-menu">
          <MenuButton open={openMenu === "insert"} label="插入" icon={<MoreHorizontal size={15} />} onClick={() => toggleMenu("insert")} />
          {openMenu === "insert" && (
            <MenuPanel onClose={closeMenu}>
              {[
                ["divider", "分割线", Minus],
                ["inlineMath", "行内公式", Code],
                ["blockMath", "块级公式", Code2],
                ["callout", "提示块", Quote],
                ["details", "折叠块", ChevronDown],
                ["mermaid", "Mermaid 图", GitGraph],
                ["kbd", "键盘按键", Command],
                ["bookmark", "书签卡片", Bookmark],
                ["pageBreak", "分页符", FileCode2],
              ].map(([value, label, Icon]) => (
                <button key={value as string} type="button" onMouseDown={(event) => { event.preventDefault(); insertBlock(value as string) }} className="notion-editor-menu-row">
                  <Icon size={15} />
                  <span>{label as string}</span>
                </button>
              ))}
            </MenuPanel>
          )}
        </div>

        <div className="notion-editor-menu">
          <MenuButton open={openMenu === "color"} label="颜色" icon={<Highlighter size={15} />} onClick={() => toggleMenu("color")} />
          {openMenu === "color" && (
            <MenuPanel onClose={closeMenu} wide>
              <div className="notion-color-section">
                <span>文字</span>
                <div className="notion-color-grid">
                  {TEXT_COLORS.map((color) => (
                    <button key={color} type="button" title={color} className="notion-color-swatch" style={{ backgroundColor: color }} onMouseDown={(event) => { event.preventDefault(); runStableEditorAction(() => editor?.chain().focus().setColor(color).run(), { closeMenu: true }) }} />
                  ))}
                </div>
              </div>
              <div className="notion-color-section">
                <span>背景</span>
                <div className="notion-color-grid">
                  {HIGHLIGHT_COLORS.map((color) => (
                    <button key={color} type="button" title={color} className="notion-color-swatch" style={{ backgroundColor: color }} onMouseDown={(event) => { event.preventDefault(); runStableEditorAction(() => editor?.chain().focus().toggleHighlight({ color }).run(), { closeMenu: true }) }} />
                  ))}
                </div>
              </div>
            </MenuPanel>
          )}
        </div>

        <div className="notion-editor-separator" />
        <button type="button" onMouseDown={(event) => { event.preventDefault(); onToggleEditType() }} className="notion-editor-source-pill">
          <FileCode2 size={15} />
          源码
        </button>
        <button type="button" onMouseDown={(event) => { event.preventDefault(); onOpenImageManager() }} className="notion-editor-menu-button">
          <FolderOpen size={15} />
          素材
        </button>
      </div>
    </div>
  )
}
