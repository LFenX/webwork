"use client"

import { useCallback, useRef, useState } from "react"
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
  Columns3,
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
  Maximize2,
  Minimize2,
  Minus,
  Quote,
  Redo2,
  Rows3,
  Strikethrough,
  Subscript,
  Superscript,
  Table,
  Trash2,
  Underline,
  Undo2,
} from "lucide-react"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ALLOWED_MIME, UPLOAD_ERROR_MESSAGES } from "@/lib/upload"

interface EditorToolbarProps {
  editor: Editor | null
  postId?: string
  fullscreen: boolean
  onToggleFullscreen: () => void
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
          <div className="absolute left-0 top-full z-50 mt-1 w-[156px] rounded-[--radius-md] border border-[--color-border] bg-[--color-bg-surface] p-2 shadow-lg">
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
      <ToolBtn onClick={() => setOpen(true)} title="插入图片">
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
                onDragOver={(event) => {
                  event.preventDefault()
                  setDragOver(true)
                }}
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
      <ToolBtn onClick={openDialog} active={editor?.isActive("link")} title="插入链接">
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

function TableDialog({ editor }: { editor: Editor | null }) {
  const [rows, setRows] = useState(3)
  const [cols, setCols] = useState(3)
  const [open, setOpen] = useState(false)

  function insert() {
    editor?.chain().focus().insertTable({ rows, cols, withHeaderRow: true }).run()
    setOpen(false)
  }

  return (
    <>
      <ToolBtn onClick={() => setOpen(true)} title="插入表格">
        <Table size={14} />
      </ToolBtn>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xs">
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
            <button
              type="button"
              onClick={insert}
              className="h-8 w-full rounded-[--radius-sm] bg-[--color-text-primary] text-sm text-white"
            >
              插入 {rows} x {cols} 表格
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

export function EditorToolbar({
  editor,
  postId,
  fullscreen,
  onToggleFullscreen,
  onOpenImageManager,
  editType,
  onToggleEditType,
}: EditorToolbarProps) {
  const [openColorPicker, setOpenColorPicker] = useState<string | null>(null)

  const insertMath = useCallback((block: boolean) => {
    if (!editor) return
    const formula = window.prompt(block ? "输入块级公式" : "输入行内公式", block ? "E = mc^2" : "x^2")
    if (!formula?.trim()) return
    editor.chain().focus().insertContent({
      type: block ? "blockMath" : "inlineMath",
      attrs: { formula: formula.trim() },
    }).run()
  }, [editor])

  const insertDetails = useCallback(() => {
    editor?.chain().focus().insertContent("<details><summary>点击展开</summary><p>内容</p></details>").run()
  }, [editor])

  const insertCallout = useCallback((type: string) => {
    const map: Record<string, string> = {
      note: "NOTE",
      tip: "TIP",
      warning: "WARNING",
      important: "IMPORTANT",
    }
    editor?.chain().focus().insertContent(`\n> [!${map[type] ?? "NOTE"}]\n> 内容\n`).run()
  }, [editor])

  const insertMermaid = useCallback(() => {
    editor?.chain().focus().insertContent("```mermaid\ngraph TD\n  A --> B\n```").run()
  }, [editor])

  const insertPageBreak = useCallback(() => {
    editor?.chain().focus().insertContent('<div class="page-break"></div>').run()
  }, [editor])

  if (!editor) return null

  return (
    <div className="flex flex-wrap items-center gap-0.5 rounded-t-[--radius-md] border-b border-[--color-border] bg-[--color-bg-primary] px-2 py-1.5">
      <ToolBtn onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="撤销 (Ctrl+Z)">
        <Undo2 size={14} />
      </ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="重做 (Ctrl+Y)">
        <Redo2 size={14} />
      </ToolBtn>

      <Separator />

      <ToolBtn onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive("heading", { level: 1 })} title="标题 1">
        <Heading1 size={14} />
      </ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive("heading", { level: 2 })} title="标题 2">
        <Heading2 size={14} />
      </ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive("heading", { level: 3 })} title="标题 3">
        <Heading3 size={14} />
      </ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()} active={editor.isActive("heading", { level: 4 })} title="标题 4">
        <Heading4 size={14} />
      </ToolBtn>

      <Separator />

      <ToolBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} title="粗体 (Ctrl+B)">
        <Bold size={14} />
      </ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} title="斜体 (Ctrl+I)">
        <Italic size={14} />
      </ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive("underline")} title="下划线 (Ctrl+U)">
        <Underline size={14} />
      </ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive("strike")} title="删除线">
        <Strikethrough size={14} />
      </ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().toggleCode().run()} active={editor.isActive("code")} title="行内代码">
        <Code size={14} />
      </ToolBtn>

      <Separator />

      <ColorPicker
        id="text"
        colors={TEXT_COLORS}
        open={openColorPicker === "text"}
        onOpenChange={setOpenColorPicker}
        onSelect={(color) => editor.chain().focus().setColor(color).run()}
      >
        <span className="text-xs font-bold" style={{ color: (editor.getAttributes("textStyle").color as string) || "currentColor" }}>A</span>
      </ColorPicker>
      <ColorPicker
        id="highlight"
        colors={HIGHLIGHT_COLORS}
        open={openColorPicker === "highlight"}
        onOpenChange={setOpenColorPicker}
        onSelect={(color) => editor.chain().focus().toggleHighlight({ color }).run()}
      >
        <Highlighter size={14} />
      </ColorPicker>

      <Separator />

      <ToolBtn onClick={() => editor.chain().focus().setTextAlign("left").run()} active={editor.isActive({ textAlign: "left" })} title="左对齐">
        <AlignLeft size={14} />
      </ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().setTextAlign("center").run()} active={editor.isActive({ textAlign: "center" })} title="居中">
        <AlignCenter size={14} />
      </ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().setTextAlign("right").run()} active={editor.isActive({ textAlign: "right" })} title="右对齐">
        <AlignRight size={14} />
      </ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().setTextAlign("justify").run()} active={editor.isActive({ textAlign: "justify" })} title="两端对齐">
        <AlignJustify size={14} />
      </ToolBtn>

      <Separator />

      <ToolBtn onClick={() => editor.chain().focus().toggleSuperscript().run()} active={editor.isActive("superscript")} title="上标">
        <Superscript size={14} />
      </ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().toggleSubscript().run()} active={editor.isActive("subscript")} title="下标">
        <Subscript size={14} />
      </ToolBtn>

      <Separator />

      <ToolBtn onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive("blockquote")} title="引用">
        <Quote size={14} />
      </ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().setHorizontalRule().run()} title="分割线">
        <Minus size={14} />
      </ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive("codeBlock")} title="代码块">
        <Code2 size={14} />
      </ToolBtn>

      <Separator />

      <ToolBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")} title="无序列表">
        <List size={14} />
      </ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")} title="有序列表">
        <ListOrdered size={14} />
      </ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().toggleTaskList().run()} active={editor.isActive("taskList")} title="任务列表">
        <CheckSquare size={14} />
      </ToolBtn>

      <Separator />

      <LinkDialog editor={editor} />
      <ImageInsertDialog editor={editor} postId={postId} />
      <TableDialog editor={editor} />
      {editor.isActive("table") && (
        <>
          <ToolBtn onClick={() => editor.chain().focus().addColumnAfter().run()} title="添加列">
            <Columns3 size={14} />
          </ToolBtn>
          <ToolBtn onClick={() => editor.chain().focus().addRowAfter().run()} title="添加行">
            <Rows3 size={14} />
          </ToolBtn>
          <ToolBtn onClick={() => editor.chain().focus().deleteTable().run()} title="删除表格">
            <Trash2 size={14} />
          </ToolBtn>
        </>
      )}
      <ToolBtn onClick={() => insertMath(false)} title="行内数学公式">
        <FunctionSquare size={14} />
      </ToolBtn>
      <ToolBtn onClick={() => insertMath(true)} title="块级数学公式">
        <span className="text-xs font-mono leading-none">Σ</span>
      </ToolBtn>

      <Separator />

      <ToolBtn onClick={insertDetails} title="折叠块">
        <ChevronDown size={14} />
      </ToolBtn>
      <ToolBtn onClick={() => insertCallout("note")} title="提示框">
        <AlertCircle size={14} />
      </ToolBtn>
      <ToolBtn onClick={insertMermaid} title="Mermaid 图表">
        <FileCode2 size={14} />
      </ToolBtn>
      <ToolBtn onClick={insertPageBreak} title="分页符">
        <Rows3 size={14} />
      </ToolBtn>

      <Separator />

      <ToolBtn onClick={onOpenImageManager} title="图片库">
        <FolderOpen size={14} />
      </ToolBtn>
      <ToolBtn
        onClick={onToggleEditType}
        active={editType === "markdown"}
        title={editType === "wysiwyg" ? "切换到源码模式" : "切换到所见即所得"}
      >
        <FileCode2 size={14} />
      </ToolBtn>
      <ToolBtn onClick={onToggleFullscreen} title={fullscreen ? "恢复编辑框宽度" : "加宽编辑框"}>
        {fullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
      </ToolBtn>
    </div>
  )
}
