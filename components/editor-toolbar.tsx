"use client"

import { useRef, useState } from "react"
import type { Editor } from "@tiptap/react"
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  AlertCircle,
  Bold,
  CheckSquare,
  ChevronDown,
  Code,
  Code2,
  FileCode2,
  FolderOpen,
  FunctionSquare,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Highlighter,
  Image as ImageIcon,
  Italic,
  Link2,
  List,
  ListOrdered,
  MoreHorizontal,
  Minus,
  Quote,
  Redo2,
  Strikethrough,
  Subscript,
  Superscript,
  Table,
  Underline,
  Undo2,
  SeparatorHorizontal,
} from "lucide-react"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ALLOWED_MIME, UPLOAD_ERROR_MESSAGES } from "@/lib/upload"
import { HR_VARIANTS, type HRVariant } from "@/components/editor/hr-variants"
import { TABLE_VARIANTS, type TableVariant } from "@/components/editor/table-variants"

interface EditorToolbarProps {
  editor: Editor | null
  postId?: string
  onOpenImageManager: () => void
  editType: "wysiwyg" | "markdown"
  onToggleEditType: () => void
}

const TEXT_COLORS = [
  "#1A1A1A", "#6B6B6B", "#9A9A9A", "#EF4444", "#F97316",
  "#EAB308", "#22C55E", "#3B82F6", "#8B5CF6", "#EC4899",
  "#FFFFFF", "#FEF08A", "#BBF7D0", "#BFDBFE", "#F5D0FE",
]

const HIGHLIGHT_COLORS = [
  "#FEF9C3", "#FEE2E2", "#DBEAFE", "#DCFCE7", "#F3E8FF",
  "#FFE4E6", "#E0F2FE", "#FFF7ED", "#FAFAFA", "#FCE7F3",
]

function Separator() {
  return <div className="mx-1 h-5 w-px shrink-0 bg-[--color-border-strong]" />
}

function ToolBtn({
  onClick,
  active,
  disabled,
  title,
  children,
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
      onMouseDown={(event) => {
        event.preventDefault()
        onClick?.()
      }}
      disabled={disabled}
      title={title}
      className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded transition-colors ${
        active
          ? "bg-[--color-text-primary] text-[--color-bg-surface]"
          : "text-[--color-text-secondary] hover:bg-[--color-bg-hover] hover:text-[--color-text-primary]"
      } disabled:pointer-events-none disabled:opacity-40`}
    >
      {children}
    </button>
  )
}

function ColorPicker({
  id,
  colors,
  open,
  onOpenChange,
  onSelect,
  children,
}: {
  id: string
  colors: string[]
  open: boolean
  onOpenChange: (id: string | null) => void
  onSelect: (color: string) => void
  children: React.ReactNode
}) {
  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onMouseDown={(event) => {
          event.preventDefault()
          onOpenChange(open ? null : id)
        }}
        title="颜色"
        className="inline-flex h-7 w-7 items-center justify-center rounded text-[--color-text-secondary] transition-colors hover:bg-[--color-bg-hover] hover:text-[--color-text-primary]"
      >
        {children}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => onOpenChange(null)} />
          <div className="editor-floating-panel absolute left-0 top-full z-50 mt-1 w-[156px] rounded-[--radius-md] p-2 shadow-lg">
            <div className="grid grid-cols-5 gap-1">
              {colors.map((color) => (
                <button
                  key={color}
                  type="button"
                  onMouseDown={(event) => {
                    event.preventDefault()
                    onSelect(color)
                    onOpenChange(null)
                  }}
                  className="h-5 w-5 rounded border border-[--color-border] transition-transform hover:scale-110"
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ── HR variant picker ─────────────────────────────────────────────────────────

function HRPicker({
  open,
  onOpenChange,
  onSelect,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onSelect: (variant: HRVariant) => void
}) {
  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onMouseDown={(e) => { e.preventDefault(); onOpenChange(!open) }}
        title="插入分割线"
        className="inline-flex h-7 items-center gap-0.5 rounded px-1 text-[--color-text-secondary] transition-colors hover:bg-[--color-bg-hover] hover:text-[--color-text-primary]"
      >
        <Minus size={14} />
        <ChevronDown size={10} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => onOpenChange(false)} />
          <div className="editor-floating-panel absolute left-0 top-full z-50 mt-1 min-w-[180px] rounded-[--radius-md] p-2 shadow-lg">
            {HR_VARIANTS.map((v) => (
              <button
                key={v.value}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault()
                  onSelect(v.value)
                  onOpenChange(false)
                }}
                className="flex w-full items-center justify-between gap-4 rounded px-3 py-2 text-sm hover:bg-[--color-bg-hover]"
              >
                <span className="w-20 shrink-0 font-mono text-xs leading-none text-[--color-text-muted]">{v.preview}</span>
                <span className="text-[--color-text-secondary]">{v.label}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ── Image insert dialog ───────────────────────────────────────────────────────

function ImageInsertDialog({ editor, postId }: { editor: Editor | null; postId?: string }) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<"upload" | "url">("upload")
  const [url, setUrl] = useState("")
  const [alt, setAlt] = useState("")
  const [width, setWidth] = useState(640)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function insertImage(src: string, fallbackAlt?: string) {
    editor?.chain().focus().setImage({
      src,
      alt: alt || fallbackAlt || undefined,
      width: Number.isFinite(width) ? width : undefined,
    }).run()
    setOpen(false)
    setUrl("")
    setAlt("")
    setWidth(640)
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

  function handleUrlInsert() {
    if (!url.trim()) return
    insertImage(url.trim())
  }

  return (
    <>
      <ToolBtn onClick={() => setOpen(true)} title="插入图片" disabled={!editor}>
        <ImageIcon size={14} />
      </ToolBtn>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>插入图片</DialogTitle>
          </DialogHeader>
          <div className="mb-4 flex overflow-hidden rounded-[--radius-sm] border border-[--color-border]">
            {(["upload", "url"] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setTab(item)}
                className={`flex-1 py-1.5 text-xs transition-colors ${
                  tab === item
                    ? "bg-[--color-text-primary] text-white"
                    : "text-[--color-text-secondary] hover:bg-[--color-bg-hover]"
                }`}
              >
                {item === "upload" ? "本地上传" : "图片 URL"}
              </button>
            ))}
          </div>

          {tab === "upload" ? (
            <div className="space-y-3">
              <div
                className={`cursor-pointer rounded-[--radius-md] border-2 border-dashed p-8 text-center transition-colors ${
                  dragOver
                    ? "border-[--color-accent] bg-[--color-bg-hover]"
                    : "border-[--color-border-strong] hover:border-[--color-text-muted]"
                }`}
                onDragOver={(event) => { event.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(event) => {
                  event.preventDefault()
                  setDragOver(false)
                  const file = event.dataTransfer.files[0]
                  if (file) uploadFile(file)
                }}
                onClick={() => fileInputRef.current?.click()}
              >
                <ImageIcon size={28} className="mx-auto mb-2 text-[--color-text-muted]" />
                <p className="text-sm text-[--color-text-secondary]">
                  {uploading ? "上传中..." : "点击或拖拽图片到此区域"}
                </p>
                <p className="mt-1 text-xs text-[--color-text-muted]">PNG、JPEG、WebP、GIF，最大 5 MB</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) uploadFile(file)
                }}
              />
            </div>
          ) : (
            <div>
              <label className="mb-1 block text-xs text-[--color-text-muted]">图片 URL *</label>
              <input
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://example.com/image.png"
                className="h-8 w-full rounded-[--radius-sm] border border-[--color-border-strong] bg-[--color-bg-surface] px-2.5 text-sm outline-none focus:border-[--color-text-primary]"
                onKeyDown={(event) => event.key === "Enter" && handleUrlInsert()}
              />
            </div>
          )}

          <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_110px]">
            <div>
              <label className="mb-1 block text-xs text-[--color-text-muted]">Alt 描述</label>
              <input
                value={alt}
                onChange={(event) => setAlt(event.target.value)}
                placeholder="图片描述"
                className="h-8 w-full rounded-[--radius-sm] border border-[--color-border-strong] bg-[--color-bg-surface] px-2.5 text-sm outline-none focus:border-[--color-text-primary]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-[--color-text-muted]">宽度(px)</label>
              <input
                type="number"
                min={80}
                max={1600}
                value={width}
                onChange={(event) => setWidth(Number(event.target.value))}
                className="h-8 w-full rounded-[--radius-sm] border border-[--color-border-strong] bg-[--color-bg-surface] px-2.5 text-sm outline-none focus:border-[--color-text-primary]"
              />
            </div>
          </div>

          {tab === "url" && (
            <button
              type="button"
              onClick={handleUrlInsert}
              disabled={!url.trim()}
              className="mt-3 h-8 w-full rounded-[--radius-sm] bg-[--color-text-primary] text-sm text-white disabled:opacity-40"
            >
              插入图片
            </button>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

// ── Link dialog ───────────────────────────────────────────────────────────────

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

  function handleInsert() {
    if (!href.trim()) {
      editor?.chain().focus().extendMarkRange("link").unsetLink().run()
      setOpen(false)
      return
    }
    if (text) {
      editor?.chain().focus().insertContent(`<a href="${href.trim()}">${text}</a>`).run()
    } else {
      editor?.chain().focus().extendMarkRange("link").setLink({ href: href.trim() }).run()
    }
    setOpen(false)
    setHref("")
    setText("")
  }

  return (
    <>
      <ToolBtn onClick={openDialog} active={editor?.isActive("link")} title="插入链接" disabled={!editor}>
        <Link2 size={14} />
      </ToolBtn>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>插入链接</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs text-[--color-text-muted]">链接地址 *</label>
              <input
                value={href}
                onChange={(event) => setHref(event.target.value)}
                placeholder="https://"
                className="h-8 w-full rounded-[--radius-sm] border border-[--color-border-strong] bg-[--color-bg-surface] px-2.5 text-sm outline-none focus:border-[--color-text-primary]"
                onKeyDown={(event) => event.key === "Enter" && handleInsert()}
                autoFocus
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-[--color-text-muted]">链接文字</label>
              <input
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder="留空则使用选中文字"
                className="h-8 w-full rounded-[--radius-sm] border border-[--color-border-strong] bg-[--color-bg-surface] px-2.5 text-sm outline-none focus:border-[--color-text-primary]"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleInsert}
                className="h-8 flex-1 rounded-[--radius-sm] bg-[--color-text-primary] text-sm text-white"
              >
                确认
              </button>
              {editor?.isActive("link") && (
                <button
                  type="button"
                  onClick={() => {
                    editor.chain().focus().unsetLink().run()
                    setOpen(false)
                  }}
                  className="h-8 rounded-[--radius-sm] border border-[--color-border] px-3 text-sm hover:bg-[--color-bg-hover]"
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

// ── Table insert dialog ───────────────────────────────────────────────────────

function TableDialog({ editor }: { editor: Editor | null }) {
  const [rows, setRows] = useState(3)
  const [cols, setCols] = useState(3)
  const [variant, setVariant] = useState<TableVariant>("default")
  const [withHeaderRow, setWithHeaderRow] = useState(true)
  const [open, setOpen] = useState(false)

  function insert() {
    editor?.chain().focus().insertTable({ rows, cols, withHeaderRow }).updateAttributes("table", { variant }).run()
    setOpen(false)
  }

  return (
    <>
      <ToolBtn onClick={() => setOpen(true)} title="插入表格" disabled={!editor}>
        <Table size={14} />
      </ToolBtn>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>插入表格</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="mb-1 block text-xs text-[--color-text-muted]">行数</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={rows}
                  onChange={(event) => setRows(Number(event.target.value))}
                  className="h-8 w-full rounded-[--radius-sm] border border-[--color-border-strong] bg-[--color-bg-surface] px-2.5 text-sm outline-none"
                />
              </div>
              <div className="flex-1">
                <label className="mb-1 block text-xs text-[--color-text-muted]">列数</label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={cols}
                  onChange={(event) => setCols(Number(event.target.value))}
                  className="h-8 w-full rounded-[--radius-sm] border border-[--color-border-strong] bg-[--color-bg-surface] px-2.5 text-sm outline-none"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs text-[--color-text-muted]">表格样式</label>
              <select
                value={variant}
                onChange={(event) => setVariant(event.target.value as TableVariant)}
                className="h-8 w-full rounded-[--radius-sm] border border-[--color-border-strong] bg-[--color-bg-surface] px-2.5 text-sm outline-none"
              >
                {TABLE_VARIANTS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-2 text-xs text-[--color-text-secondary]">
              <input
                type="checkbox"
                checked={withHeaderRow}
                onChange={(event) => setWithHeaderRow(event.target.checked)}
              />
              包含表头行
            </label>
            <button
              type="button"
              onClick={insert}
              className="mt-1 h-9 w-full rounded-[--radius-sm] bg-[--color-text-primary] text-sm font-medium text-[--color-bg-surface]"
            >
              确定插入 {rows} x {cols} 表格
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ── Main toolbar ──────────────────────────────────────────────────────────────

export function EditorToolbar({
  editor,
  postId,
  onOpenImageManager,
  editType,
  onToggleEditType,
}: EditorToolbarProps) {
  const [openColorPicker, setOpenColorPicker] = useState<string | null>(null)
  const [hrPickerOpen, setHrPickerOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)

  // Minimal toolbar for source-code mode (issue #3 fix)
  if (editType === "markdown") {
    return (
      <div className="flex items-center gap-1 rounded-t-[--radius-md] border-b border-[--color-border] bg-[--color-bg-primary] px-2 py-1.5">
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); onToggleEditType() }}
          title="切换到所见即所得"
          className="inline-flex h-7 items-center gap-1.5 rounded bg-[--color-text-primary] px-2 text-xs text-[--color-bg-surface]"
        >
          <FileCode2 size={13} />
          <span>退出源码模式</span>
        </button>
        <span className="ml-1 text-xs text-[--color-text-muted]">Markdown 源码编辑中</span>
        <div className="ml-auto">
          <ToolBtn onClick={onOpenImageManager} title="图片库">
            <FolderOpen size={14} />
          </ToolBtn>
        </div>
      </div>
    )
  }

  function insertMath(block: boolean) {
    if (!editor) return
    editor.chain().focus().insertContent({
      type: block ? "blockMath" : "inlineMath",
      attrs: { formula: block ? "E = mc^2" : "x^2" },
    }).run()
  }

  function insertDetails() {
    editor?.chain().focus().insertContent({
      type: "details",
      attrs: { open: true, summary: "点击展开" },
      content: [{ type: "paragraph", content: [{ type: "text", text: "在这里输入内容..." }] }],
    }).run()
  }

  function insertCallout(type: string) {
    editor?.chain().focus().insertContent({
      type: "callout",
      attrs: { type },
      content: [{ type: "paragraph", content: [{ type: "text", text: "内容的的" }] }],
    }).run()
  }

  function insertMermaid() {
    editor?.chain().focus().toggleCodeBlock({ language: "mermaid" }).run()
  }

  function insertPageBreak() {
    editor?.chain().focus().insertContent({ type: "pageBreak" }).run()
  }

  function insertHR(variant: HRVariant) {
    if (!editor) return
    editor.chain().focus().insertContent({ type: "horizontalRule", attrs: { variant } }).run()
  }

  const primaryTools = (
    <>
      {/* History */}
      <ToolBtn onClick={() => editor?.chain().focus().undo().run()} disabled={!editor?.can().undo()} title="撤销 (Ctrl+Z)">
        <Undo2 size={14} />
      </ToolBtn>
      <ToolBtn onClick={() => editor?.chain().focus().redo().run()} disabled={!editor?.can().redo()} title="重做 (Ctrl+Y)">
        <Redo2 size={14} />
      </ToolBtn>
      <Separator />
      <ToolBtn onClick={() => editor?.chain().focus().toggleBold().run()} active={editor?.isActive("bold")} title="粗体 (Ctrl+B)">
        <Bold size={14} />
      </ToolBtn>
      <ToolBtn onClick={() => editor?.chain().focus().toggleItalic().run()} active={editor?.isActive("italic")} title="斜体 (Ctrl+I)">
        <Italic size={14} />
      </ToolBtn>
      <ToolBtn onClick={() => editor?.chain().focus().toggleUnderline().run()} active={editor?.isActive("underline")} title="下划线 (Ctrl+U)">
        <Underline size={14} />
      </ToolBtn>
      <ToolBtn onClick={() => editor?.chain().focus().toggleStrike().run()} active={editor?.isActive("strike")} title="删除线">
        <Strikethrough size={14} />
      </ToolBtn>
      <ToolBtn onClick={() => editor?.chain().focus().toggleCode().run()} active={editor?.isActive("code")} title="行内代码">
        <Code size={14} />
      </ToolBtn>
      <Separator />
      <ToolBtn onClick={() => editor?.chain().focus().toggleBulletList().run()} active={editor?.isActive("bulletList")} title="无序列表">
        <List size={14} />
      </ToolBtn>
      <ToolBtn onClick={() => editor?.chain().focus().toggleOrderedList().run()} active={editor?.isActive("orderedList")} title="有序列表">
        <ListOrdered size={14} />
      </ToolBtn>
      <Separator />
      <ToolBtn
        onClick={onToggleEditType}
        title="切换到源码模式"
      >
        <FileCode2 size={14} />
      </ToolBtn>
    </>
  )

  const secondaryTools = (
    <>
      {/* Headings */}
      <ToolBtn onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()} active={editor?.isActive("heading", { level: 1 })} title="标题 1">
        <Heading1 size={14} />
      </ToolBtn>
      <ToolBtn onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} active={editor?.isActive("heading", { level: 2 })} title="标题 2">
        <Heading2 size={14} />
      </ToolBtn>
      <ToolBtn onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()} active={editor?.isActive("heading", { level: 3 })} title="标题 3">
        <Heading3 size={14} />
      </ToolBtn>
      <ToolBtn onClick={() => editor?.chain().focus().toggleHeading({ level: 4 }).run()} active={editor?.isActive("heading", { level: 4 })} title="标题 4">
        <Heading4 size={14} />
      </ToolBtn>

      <Separator />

      {/* Color */}
      <ColorPicker
        id="text"
        colors={TEXT_COLORS}
        open={openColorPicker === "text"}
        onOpenChange={setOpenColorPicker}
        onSelect={(color) => editor?.chain().focus().setColor(color).run()}
      >
        <span className="text-xs font-bold" style={{ color: (editor?.getAttributes("textStyle").color as string) || "currentColor" }}>A</span>
      </ColorPicker>
      <ColorPicker
        id="highlight"
        colors={HIGHLIGHT_COLORS}
        open={openColorPicker === "highlight"}
        onOpenChange={setOpenColorPicker}
        onSelect={(color) => editor?.chain().focus().toggleHighlight({ color }).run()}
      >
        <Highlighter size={14} />
      </ColorPicker>

      <Separator />

      {/* Alignment */}
      <ToolBtn onClick={() => editor?.chain().focus().setTextAlign("left").run()} active={editor?.isActive({ textAlign: "left" })} title="左对齐">
        <AlignLeft size={14} />
      </ToolBtn>
      <ToolBtn onClick={() => editor?.chain().focus().setTextAlign("center").run()} active={editor?.isActive({ textAlign: "center" })} title="居中">
        <AlignCenter size={14} />
      </ToolBtn>
      <ToolBtn onClick={() => editor?.chain().focus().setTextAlign("right").run()} active={editor?.isActive({ textAlign: "right" })} title="右对齐">
        <AlignRight size={14} />
      </ToolBtn>
      <ToolBtn onClick={() => editor?.chain().focus().setTextAlign("justify").run()} active={editor?.isActive({ textAlign: "justify" })} title="两端对齐">
        <AlignJustify size={14} />
      </ToolBtn>

      <Separator />

      {/* Script */}
      <ToolBtn onClick={() => editor?.chain().focus().toggleSuperscript().run()} active={editor?.isActive("superscript")} title="上标">
        <Superscript size={14} />
      </ToolBtn>
      <ToolBtn onClick={() => editor?.chain().focus().toggleSubscript().run()} active={editor?.isActive("subscript")} title="下标">
        <Subscript size={14} />
      </ToolBtn>

      <Separator />

      {/* Block elements */}
      <ToolBtn onClick={() => editor?.chain().focus().toggleBlockquote().run()} active={editor?.isActive("blockquote")} title="引用">
        <Quote size={14} />
      </ToolBtn>
      <ToolBtn onClick={() => editor?.chain().focus().toggleCodeBlock().run()} active={editor?.isActive("codeBlock")} title="代码块">
        <Code2 size={14} />
      </ToolBtn>
      <HRPicker open={hrPickerOpen} onOpenChange={setHrPickerOpen} onSelect={insertHR} />

      <Separator />

      <ToolBtn onClick={() => editor?.chain().focus().toggleTaskList().run()} active={editor?.isActive("taskList")} title="任务列表">
        <CheckSquare size={14} />
      </ToolBtn>

      <Separator />

      {/* Insert */}
      <LinkDialog editor={editor} />
      <ImageInsertDialog editor={editor} postId={postId} />
      <TableDialog editor={editor} />

      <Separator />

      {/* Math */}
      <ToolBtn onClick={() => insertMath(false)} title="行内数学公式（插入后点击编辑）" disabled={!editor}>
        <FunctionSquare size={14} />
      </ToolBtn>
      <ToolBtn onClick={() => insertMath(true)} title="块级数学公式（插入后点击编辑）" disabled={!editor}>
        <span className="text-xs font-mono leading-none">Σ</span>
      </ToolBtn>

      <Separator />

      {/* Advanced */}
      <ToolBtn onClick={insertDetails} title="折叠块" disabled={!editor}>
        <ChevronDown size={14} />
      </ToolBtn>
      <ToolBtn onClick={() => insertCallout("note")} title="提示框" disabled={!editor}>
        <AlertCircle size={14} />
      </ToolBtn>
      <ToolBtn onClick={insertMermaid} title="Mermaid 图表（代码块 mermaid 语言）" disabled={!editor}>
        <Code2 size={14} />
      </ToolBtn>
      <ToolBtn onClick={insertPageBreak} title="分页符" disabled={!editor}>
        <SeparatorHorizontal size={14} />
      </ToolBtn>

      <Separator />

      {/* Mode & assets */}
      <ToolBtn onClick={onOpenImageManager} title="图片库">
        <FolderOpen size={14} />
      </ToolBtn>
    </>
  )

  return (
    <>
      <div className="editor-toolbar relative z-[1000] hidden w-full min-w-0 max-w-full flex-wrap items-center gap-0.5 overflow-visible rounded-t-[--radius-md] border-b border-[--color-border] bg-[--color-bg-primary] px-2 py-1.5 md:flex">
        {primaryTools}
        <Separator />
        {secondaryTools}
      </div>
      <div className="editor-toolbar relative z-[1000] flex w-full min-w-0 max-w-full items-center gap-0.5 rounded-t-[--radius-md] border-b border-[--color-border] bg-[--color-bg-primary] px-2 py-1.5 md:hidden">
        {primaryTools}
        <div className="ml-auto">
          <ToolBtn onClick={() => setMoreOpen((open) => !open)} title="更多工具">
            <MoreHorizontal size={15} />
          </ToolBtn>
        </div>
        {moreOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMoreOpen(false)} />
            <div className="absolute left-2 right-2 top-full z-50 mt-1 max-h-[70vh] overflow-y-auto rounded-[--radius-md] border border-[--color-border] bg-[--color-bg-surface] p-3 shadow-lg">
              <div className="grid grid-cols-6 gap-1.5">
                {secondaryTools}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  )
}
