"use client"

import { useRef, useState } from "react"
import { EditorContent, NodeViewWrapper, ReactNodeViewRenderer, useEditor } from "@tiptap/react"
import { Node, mergeAttributes } from "@tiptap/core"
import { StarterKit } from "@tiptap/starter-kit"
import { Image as TiptapImage } from "@tiptap/extension-image"
import { Link } from "@tiptap/extension-link"
import { Table } from "@tiptap/extension-table"
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
import { EditorToolbar } from "@/components/editor-toolbar"
import { ImageManagerDialog } from "@/components/image-manager-dialog"
import { ALLOWED_MIME, UPLOAD_ERROR_MESSAGES } from "@/lib/upload"

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

function MathPreview({ formula, displayMode }: { formula: string; displayMode: boolean }) {
  let html = ""
  try {
    html = katex.renderToString(formula || "x", {
      displayMode,
      throwOnError: false,
      strict: false,
    })
  } catch {
    html = escapeHtml(formula || "x")
  }

  return (
    <span
      className={displayMode ? "tiptap-math tiptap-math-block" : "tiptap-math tiptap-math-inline"}
      data-formula={formula}
      dangerouslySetInnerHTML={{ __html: html }}
    />
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
    return ReactNodeViewRenderer(({ node, selected }) => (
      <NodeViewWrapper as="span" className={selected ? "is-selected" : ""}>
        <MathPreview formula={node.attrs.formula} displayMode={false} />
      </NodeViewWrapper>
    ))
  },
})

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
    return ReactNodeViewRenderer(({ node, selected }) => (
      <NodeViewWrapper className={selected ? "is-selected" : ""}>
        <MathPreview formula={node.attrs.formula} displayMode />
      </NodeViewWrapper>
    ))
  },
})

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

interface MarkdownEditorInnerProps {
  value: string
  onChange: (value: string) => void
  height?: number
  initialEditType?: "wysiwyg" | "markdown"
  postId?: string
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

export function MarkdownEditorInner({
  value,
  onChange,
  height = 600,
  initialEditType = "wysiwyg",
  postId,
}: MarkdownEditorInnerProps) {
  const [editType, setEditType] = useState<"wysiwyg" | "markdown">(initialEditType)
  const [fullscreen, setFullscreen] = useState(false)
  const [imgManagerOpen, setImgManagerOpen] = useState(false)
  const [markdownSource, setMarkdownSource] = useState(value)
  const markdownRef = useRef(value)
  const isInternalChange = useRef(false)

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      CodeBlockLowlight.configure({ lowlight }),
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
      Table.configure({ resizable: true }),
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
      Placeholder.configure({ placeholder: "开始写作..." }),
      Markdown.configure({ html: true, tightLists: true, linkify: false, breaks: true }),
    ],
    content: normalizeMarkdownForEditor(value),
    onUpdate({ editor }) {
      if (isInternalChange.current) return
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const md = (editor.storage as any).markdown.getMarkdown() as string
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

  function switchToMarkdown() {
    if (editor) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      markdownRef.current = (editor.storage as any).markdown.getMarkdown() as string
      setMarkdownSource(markdownRef.current)
    }
    setEditType("markdown")
  }

  function switchToWysiwyg() {
    if (editor) {
      isInternalChange.current = true
      editor.commands.setContent(normalizeMarkdownForEditor(markdownRef.current))
      isInternalChange.current = false
    }
    setEditType("wysiwyg")
  }

  function handleToggleEditType() {
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
    <div
      className={`tiptap-wrapper border border-[--color-border] rounded-[--radius-md] overflow-hidden bg-[--color-bg-surface] ${
        fullscreen
          ? "relative left-1/2 z-10 flex w-[calc(100vw-3rem)] max-w-[1600px] -translate-x-1/2 flex-col shadow-lg"
          : "flex flex-col"
      }`}
    >
      <EditorToolbar
        editor={editType === "wysiwyg" ? editor : null}
        postId={postId}
        fullscreen={fullscreen}
        onToggleFullscreen={() => setFullscreen((f) => !f)}
        onOpenImageManager={() => setImgManagerOpen(true)}
        editType={editType}
        onToggleEditType={handleToggleEditType}
      />

      <div className={fullscreen ? "max-h-[calc(var(--app-viewport-height)-9rem)] overflow-y-auto" : ""} style={{ minHeight: editorMinHeight }}>
        {editType === "wysiwyg" ? (
          <EditorContent
            editor={editor}
            className="tiptap-content"
            style={{ minHeight: editorMinHeight }}
          />
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
