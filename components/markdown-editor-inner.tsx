"use client"

import { useEffect, useRef, useState } from "react"
import { EditorContent, NodeViewWrapper, ReactNodeViewRenderer, useEditor } from "@tiptap/react"
import { BubbleMenu } from "@tiptap/react/menus"
import type { NodeViewProps } from "@tiptap/core"
import { Node, mergeAttributes } from "@tiptap/core"
import { StarterKit } from "@tiptap/starter-kit"
import { Image as TiptapImage } from "@tiptap/extension-image"
import { Link } from "@tiptap/extension-link"
import { TableRow } from "@tiptap/extension-table-row"
import { TableCell } from "@tiptap/extension-table-cell"
import { TableHeader } from "@tiptap/extension-table-header"
import { TaskList } from "@tiptap/extension-task-list"
import { TaskItem } from "@tiptap/extension-task-item"
import { TextAlign } from "@tiptap/extension-text-align"
import { Underline } from "@tiptap/extension-underline"
import { Subscript } from "@tiptap/extension-subscript"
import { Superscript } from "@tiptap/extension-superscript"
import { Color } from "@tiptap/extension-color"
import { TextStyle } from "@tiptap/extension-text-style"
import { Highlight } from "@tiptap/extension-highlight"
import { CodeBlockLowlight } from "@tiptap/extension-code-block-lowlight"
import { Placeholder } from "@tiptap/extension-placeholder"
import { Markdown } from "tiptap-markdown"
import { createLowlight, all } from "lowlight"
import katex from "katex"
import { toast } from "sonner"
import { Columns3, Rows3, Trash2, Merge, SplitSquareHorizontal } from "lucide-react"
import { EditorToolbar } from "@/components/editor-toolbar"
import { ImageManagerDialog } from "@/components/image-manager-dialog"
import { ALLOWED_MIME, UPLOAD_ERROR_MESSAGES } from "@/lib/upload"
import { CodeBlockView } from "@/components/editor/code-block-view"
import { HorizontalRuleVariant } from "@/components/editor/hr-variants"
import { PageBreak } from "@/components/editor/page-break-extension"
import { Details } from "@/components/editor/details-extension"
import { TABLE_VARIANTS, TableVariantExtension } from "@/components/editor/table-variants"
import { Callout } from "@/components/editor/callout-extension"

const lowlight = createLowlight(all)

type MarkdownSerializeState = {
  write: (content: string) => void
  closeBlock: (node: unknown) => void
}
type MarkdownSerializeNode = {
  attrs: Record<string, string | number | null | undefined>
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}

function normalizeMarkdownForEditor(markdown: string) {
  return markdown
    .replace(/(^|\n)\$\$\s*\n?([\s\S]*?)\n?\s*\$\$(?=\n|$)/g, (_match, prefix, formula) => {
      return `${prefix}<div data-math-block="${escapeHtml(formula.trim())}"></div>`
    })
    .replace(/(^|[^\$])\$([^\n$]+?)\$/g, (_match, prefix, formula) => {
      return `${prefix}<span data-math-inline="${escapeHtml(formula.trim())}"></span>`
    })
}

function renderKatex(formula: string, displayMode: boolean): string {
  try {
    return katex.renderToString(formula || "x", {
      displayMode,
      throwOnError: false,
      strict: false,
    })
  } catch {
    return escapeHtml(formula || "x")
  }
}

// ── Inline Math ───────────────────────────────────────────────────────────────

function InlineMathView({ node, updateAttributes, selected }: NodeViewProps) {
  const [editing, setEditing] = useState(false)
  const [formula, setFormula] = useState<string>((node.attrs.formula as string) || "x")
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!editing) return
    requestAnimationFrame(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    })
  }, [editing])

  function beginEdit() {
    setFormula((node.attrs.formula as string) || "x")
    setEditing(true)
  }

  function commit() {
    const f = formula.trim() || "x"
    updateAttributes({ formula: f })
    setEditing(false)
  }

  return (
    <NodeViewWrapper as="span" className={selected ? "is-selected" : ""}>
      {editing ? (
        <input
          ref={inputRef}
          value={formula}
          onChange={(e) => setFormula(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === "Escape") {
              e.preventDefault()
              commit()
            }
          }}
          className="tiptap-math-edit inline-block rounded border border-[--color-accent] bg-[--color-bg-surface] px-1 font-mono text-sm outline-none"
          style={{ minWidth: "4ch", width: `${Math.max((formula || "").length + 1, 5)}ch` }}
          title="按 Enter 或 Escape 确认"
        />
      ) : (
        <span
          className="tiptap-math tiptap-math-inline"
          data-formula={node.attrs.formula}
          onClick={beginEdit}
          dangerouslySetInnerHTML={{ __html: renderKatex(node.attrs.formula as string, false) }}
        />
      )}
    </NodeViewWrapper>
  )
}

const InlineMath = Node.create({
  name: "inlineMath",
  group: "inline",
  inline: true,
  atom: true,

  addAttributes() {
    return {
      formula: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-math-inline") ?? element.textContent ?? "",
        renderHTML: (attributes) => ({ "data-math-inline": attributes.formula }),
      },
    }
  },

  parseHTML() {
    return [{ tag: "span[data-math-inline]" }]
  },

  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes)]
  },

  addStorage() {
    return {
      markdown: {
        serialize(state: MarkdownSerializeState, node: MarkdownSerializeNode) {
          state.write(`$${node.attrs.formula || "x"}$`)
        },
        parse: {},
      },
    }
  },

  addNodeView() {
    return ReactNodeViewRenderer(InlineMathView)
  },
})

// ── Block Math ────────────────────────────────────────────────────────────────

function BlockMathView({ node, updateAttributes, selected }: NodeViewProps) {
  const [editing, setEditing] = useState(false)
  const [formula, setFormula] = useState<string>((node.attrs.formula as string) || "x")
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [katexError, setKatexError] = useState("")

  useEffect(() => {
    if (!editing) return
    requestAnimationFrame(() => {
      textareaRef.current?.focus()
      textareaRef.current?.select()
    })
  }, [editing])

  function beginEdit() {
    setFormula((node.attrs.formula as string) || "x")
    setEditing(true)
  }

  function commit() {
    const f = formula.trim() || "x"
    try {
      katex.renderToString(f, { throwOnError: true })
      setKatexError("")
    } catch (err) {
      setKatexError(err instanceof Error ? err.message : "公式错误")
    }
    updateAttributes({ formula: f })
    setEditing(false)
  }

  return (
    <NodeViewWrapper>
      {editing ? (
        <div className="tiptap-math-block-edit my-3 rounded-[--radius-md] border border-[--color-accent] bg-[--color-bg-surface] p-3">
          <p className="mb-1 text-xs text-[--color-text-muted]">编辑 LaTeX 公式（按 Ctrl+Enter 或点击外部确认）</p>
          <textarea
            ref={textareaRef}
            value={formula}
            onChange={(e) => setFormula(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                e.preventDefault()
                commit()
              }
              if (e.key === "Escape") {
                e.preventDefault()
                commit()
              }
            }}
            rows={3}
            className="w-full resize-y rounded border border-[--color-border] bg-[--color-bg-primary] p-2 font-mono text-sm outline-none focus:border-[--color-text-muted]"
            placeholder="E = mc^2"
          />
          {katexError && (
            <p className="mt-1 text-xs text-[--color-danger]">{katexError}</p>
          )}
        </div>
      ) : (
        <div
          className={`tiptap-math tiptap-math-block ${selected ? "is-selected" : ""}`}
          data-formula={node.attrs.formula}
          onClick={beginEdit}
          dangerouslySetInnerHTML={{ __html: renderKatex(node.attrs.formula as string, true) }}
        />
      )}
    </NodeViewWrapper>
  )
}

const BlockMath = Node.create({
  name: "blockMath",
  group: "block",
  atom: true,

  addAttributes() {
    return {
      formula: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-math-block") ?? element.textContent ?? "",
        renderHTML: (attributes) => ({ "data-math-block": attributes.formula }),
      },
    }
  },

  parseHTML() {
    return [{ tag: "div[data-math-block]" }]
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes)]
  },

  addStorage() {
    return {
      markdown: {
        serialize(state: MarkdownSerializeState, node: MarkdownSerializeNode) {
          state.write(`$$\n${node.attrs.formula || "x"}\n$$`)
          state.closeBlock(node)
        },
        parse: {},
      },
    }
  },

  addNodeView() {
    return ReactNodeViewRenderer(BlockMathView)
  },
})

// ── Resizable Image ───────────────────────────────────────────────────────────

const ResizableImage = TiptapImage.extend({
  addStorage() {
    return {
      markdown: {
        serialize(state: MarkdownSerializeState, node: MarkdownSerializeNode) {
          const { src, alt, title, width, height } = node.attrs
          if (width || height) {
            const attrs = [
              `src="${escapeHtml(String(src ?? ""))}"`,
              alt ? `alt="${escapeHtml(String(alt))}"` : "",
              title ? `title="${escapeHtml(String(title))}"` : "",
              width ? `width="${Number(width)}"` : "",
              height ? `height="${Number(height)}"` : "",
            ].filter(Boolean)
            state.write(`<img ${attrs.join(" ")} />`)
            state.closeBlock(node)
            return
          }
          state.write(title ? `![${alt ?? ""}](${src} "${title}")` : `![${alt ?? ""}](${src})`)
          state.closeBlock(node)
        },
        parse: {},
      },
    }
  },
})

// ── Custom CodeBlock with NodeView ────────────────────────────────────────────

const CustomCodeBlock = CodeBlockLowlight.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      theme: {
        default: "default",
        parseHTML: (element) => element.getAttribute("data-theme") || "default",
        renderHTML: (attributes) => ({ "data-theme": attributes.theme || "default" }),
      },
    }
  },

  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockView)
  },
})

// ── Props & upload helper ─────────────────────────────────────────────────────

interface MarkdownEditorInnerProps {
  value: string
  onChange: (value: string) => void
  height?: number
  initialEditType?: "wysiwyg" | "markdown"
  postId?: string
  hideToolbar?: boolean
  onEditorReady?: (editor: import("@tiptap/core").Editor) => void
  editType?: "wysiwyg" | "markdown"
  onToggleEditType?: () => void
}

async function uploadImageFile(file: File, postId?: string): Promise<string | null> {
  if (!ALLOWED_MIME.has(file.type)) {
    toast.error(UPLOAD_ERROR_MESSAGES.invalid_mime)
    return null
  }
  const fd = new FormData()
  fd.append("file", file)
  if (postId) fd.append("postId", postId)
  try {
    const res = await fetch("/api/upload", { method: "POST", body: fd })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      toast.error(UPLOAD_ERROR_MESSAGES[err.error as string] ?? "上传失败")
      return null
    }
    const { url } = await res.json()
    return url as string
  } catch {
    toast.error("上传失败，请检查网络")
    return null
  }
}

// ── Table BubbleMenu ──────────────────────────────────────────────────────────

function TableBubbleMenu({ editor }: { editor: import("@tiptap/core").Editor | null }) {
  if (!editor) return null
  return (
    <BubbleMenu
      editor={editor}
      shouldShow={({ editor: ed }) => ed.isActive("table")}
      options={{ placement: "top", offset: 8 }}
      className="flex max-w-[min(96vw,760px)] flex-wrap items-center gap-1 rounded-[--radius-md] border border-[--color-border] bg-[--color-bg-surface] px-1.5 py-1.5 shadow-lg"
    >
      <button
        type="button"
        onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().addColumnBefore().run() }}
        title="在左侧插入列"
        className="inline-flex h-6 w-6 items-center justify-center rounded text-xs text-[--color-text-secondary] hover:bg-[--color-bg-hover]"
      >
        ←C
      </button>
      <button
        type="button"
        onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().addColumnAfter().run() }}
        title="在右侧插入列"
        className="inline-flex h-6 w-6 items-center justify-center rounded hover:bg-[--color-bg-hover]"
      >
        <Columns3 size={12} />
      </button>
      <button
        type="button"
        onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().addRowBefore().run() }}
        title="在上方插入行"
        className="inline-flex h-6 w-6 items-center justify-center rounded text-xs text-[--color-text-secondary] hover:bg-[--color-bg-hover]"
      >
        ↑R
      </button>
      <button
        type="button"
        onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().addRowAfter().run() }}
        title="在下方插入行"
        className="inline-flex h-6 w-6 items-center justify-center rounded hover:bg-[--color-bg-hover]"
      >
        <Rows3 size={12} />
      </button>
      <div className="mx-0.5 h-4 w-px bg-[--color-border-strong]" />
      <button
        type="button"
        onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().deleteColumn().run() }}
        title="删除列"
        className="inline-flex h-6 items-center justify-center rounded px-1 text-xs text-[--color-text-secondary] hover:bg-[--color-danger-bg] hover:text-[--color-danger]"
      >
        删列
      </button>
      <button
        type="button"
        onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().deleteRow().run() }}
        title="删除行"
        className="inline-flex h-6 items-center justify-center rounded px-1 text-xs text-[--color-text-secondary] hover:bg-[--color-danger-bg] hover:text-[--color-danger]"
      >
        删行
      </button>
      <button
        type="button"
        onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().mergeCells().run() }}
        title="合并单元格"
        className="inline-flex h-6 w-6 items-center justify-center rounded hover:bg-[--color-bg-hover]"
      >
        <Merge size={11} />
      </button>
      <button
        type="button"
        onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().splitCell().run() }}
        title="拆分单元格"
        className="inline-flex h-6 w-6 items-center justify-center rounded hover:bg-[--color-bg-hover]"
      >
        <SplitSquareHorizontal size={11} />
      </button>
      <div className="mx-0.5 h-4 w-px bg-[--color-border-strong]" />
      <button
        type="button"
        onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().deleteTable().run() }}
        title="删除整个表格"
        className="inline-flex h-6 w-6 items-center justify-center rounded hover:bg-[--color-danger-bg] hover:text-[--color-danger]"
      >
        <Trash2 size={12} />
      </button>
      <div className="mx-0.5 h-4 w-px bg-[--color-border-strong]" />
      <button
        type="button"
        onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleHeaderRow().run() }}
        title="切换表头"
        className="inline-flex h-6 items-center justify-center rounded px-1.5 text-xs text-[--color-text-secondary] hover:bg-[--color-bg-hover]"
      >
        表头
      </button>
      <select
        value={(editor.getAttributes("table").variant as string) || "default"}
        onChange={(e) => editor.chain().focus().updateAttributes("table", { variant: e.target.value }).run()}
        className="h-6 rounded border border-[--color-border] bg-[--color-bg-surface] px-1 text-xs text-[--color-text-secondary] outline-none hover:bg-[--color-bg-hover]"
        title="表格样式"
      >
        {TABLE_VARIANTS.map((variant) => (
          <option key={variant.value} value={variant.value}>
            {variant.label}
          </option>
        ))}
      </select>
    </BubbleMenu>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function MarkdownEditorInner({
  value,
  onChange,
  height = 600,
  initialEditType = "wysiwyg",
  postId,
  hideToolbar = false,
  onEditorReady,
  editType: controlledEditType,
  onToggleEditType: controlledToggleEditType,
}: MarkdownEditorInnerProps) {
  const isControlled = controlledEditType !== undefined
  const [internalEditType, setInternalEditType] = useState<"wysiwyg" | "markdown">(initialEditType)
  const editType = isControlled ? controlledEditType : internalEditType
  const prevControlledEditType = useRef(controlledEditType)
  const [imgManagerOpen, setImgManagerOpen] = useState(false)
  const [markdownSource, setMarkdownSource] = useState(value)
  const markdownRef = useRef(value)
  const isInternalChange = useRef(false)

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ codeBlock: false, horizontalRule: false }),
      CustomCodeBlock.configure({ lowlight }),
      HorizontalRuleVariant,
      ResizableImage.configure({
        inline: false,
        allowBase64: false,
        resize: {
          enabled: true,
          directions: ["left", "right", "bottom-left", "bottom-right"],
          minWidth: 80,
          minHeight: 40,
          alwaysPreserveAspectRatio: true,
        },
      }),
      Link.configure({ openOnClick: false, HTMLAttributes: { rel: "noopener noreferrer" } }),
      TableVariantExtension.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      TaskList,
      TaskItem.configure({ nested: true }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Underline,
      Subscript,
      Superscript,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      InlineMath,
      BlockMath,
      Callout,
      Details,
      PageBreak,
      Placeholder.configure({ placeholder: "开始写作..." }),
      Markdown.configure({ html: true, tightLists: true, linkify: false, breaks: true }),
    ],
    content: normalizeMarkdownForEditor(value),
    onUpdate({ editor: ed }) {
      if (isInternalChange.current) return
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const md = (ed.storage as any).markdown.getMarkdown() as string
      markdownRef.current = md
      setMarkdownSource(md)
      onChange(md)
    },
    editorProps: {
      handlePaste(_, event) {
        const items = event.clipboardData?.items
        if (!items) return false
        for (const item of Array.from(items)) {
          if (item.type.startsWith("image/")) {
            const file = item.getAsFile()
            if (!file) continue
            event.preventDefault()
            uploadImageFile(file, postId).then((url) => {
              if (url) editor?.chain().focus().setImage({ src: url }).run()
            })
            return true
          }
        }
        return false
      },
      handleDrop(_, event, _2, moved) {
        if (!moved && event.dataTransfer?.files.length) {
          const file = event.dataTransfer.files[0]
          if (file?.type.startsWith("image/")) {
            event.preventDefault()
            uploadImageFile(file, postId).then((url) => {
              if (url) editor?.chain().focus().setImage({ src: url }).run()
            })
            return true
          }
        }
        return false
      },
    },
  })

  useEffect(() => {
    if (editor && onEditorReady) onEditorReady(editor)
  }, [editor, onEditorReady])

  // When controlled editType changes externally, sync the editor
  useEffect(() => {
    if (!isControlled || !editor) return
    if (controlledEditType === prevControlledEditType.current) return
    prevControlledEditType.current = controlledEditType

    if (controlledEditType === "markdown") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      markdownRef.current = (editor.storage as any).markdown.getMarkdown() as string
      setMarkdownSource(markdownRef.current)
    } else {
      isInternalChange.current = true
      editor.commands.setContent(normalizeMarkdownForEditor(markdownRef.current))
      isInternalChange.current = false
    }
  }, [controlledEditType, isControlled, editor])

  function switchToMarkdown() {
    if (editor) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      markdownRef.current = (editor.storage as any).markdown.getMarkdown() as string
      setMarkdownSource(markdownRef.current)
    }
    setInternalEditType("markdown")
  }

  function switchToWysiwyg() {
    if (editor) {
      isInternalChange.current = true
      editor.commands.setContent(normalizeMarkdownForEditor(markdownRef.current))
      isInternalChange.current = false
    }
    setInternalEditType("wysiwyg")
  }

  function handleToggleEditType() {
    if (isControlled && controlledToggleEditType) {
      controlledToggleEditType()
      return
    }
    if (editType === "wysiwyg") switchToMarkdown()
    else switchToWysiwyg()
  }

  function handleSourceChange(val: string) {
    markdownRef.current = val
    setMarkdownSource(val)
    onChange(val)
  }

  function handleInsertFromManager(md: string) {
    if (editType === "wysiwyg" && editor) {
      editor.chain().focus().insertContent(normalizeMarkdownForEditor(md)).run()
    } else {
      const newMd = markdownRef.current + "\n\n" + md
      handleSourceChange(newMd)
    }
  }

  const editorMinHeight = Math.max(300, height)

  return (
    <div className={`tiptap-wrapper flex w-full min-w-0 max-w-full flex-col rounded-[--radius-md] ${hideToolbar ? "" : "border border-[--color-border]"} bg-[--color-bg-surface]`}>
      {!hideToolbar && (
        <EditorToolbar
          editor={editor}
          postId={postId}
          onOpenImageManager={() => setImgManagerOpen(true)}
          editType={editType}
          onToggleEditType={handleToggleEditType}
        />
      )}

      <div className="min-w-0 max-w-full" style={{ minHeight: editorMinHeight }}>
        {editType === "wysiwyg" ? (
          <>
            <EditorContent
              editor={editor}
              className="tiptap-content min-w-0 max-w-full"
              style={{ minHeight: editorMinHeight }}
            />
            <TableBubbleMenu editor={editor} />
          </>
        ) : (
          <textarea
            value={markdownSource}
            onChange={(e) => handleSourceChange(e.target.value)}
            className="w-full resize-none outline-none font-mono text-sm p-4 bg-[--color-bg-surface] text-[--color-text-primary] leading-relaxed"
            style={{ minHeight: editorMinHeight, height: "100%" }}
            placeholder="在此输入 Markdown..."
            spellCheck={false}
          />
        )}
      </div>

      <ImageManagerDialog
        open={imgManagerOpen}
        onOpenChange={setImgManagerOpen}
        onInsert={handleInsertFromManager}
      />
    </div>
  )
}
