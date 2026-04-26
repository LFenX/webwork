"use client"

import dynamic from "next/dynamic"

const MarkdownEditorInner = dynamic(
  () => import("@/components/markdown-editor-inner").then((m) => m.MarkdownEditorInner),
  { ssr: false, loading: () => <div className="h-40 flex items-center justify-center text-sm text-[--color-text-muted] border border-[--color-border] rounded-[--radius-md]">加载编辑器...</div> }
)

interface MarkdownEditorProps {
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

export function MarkdownEditor(props: MarkdownEditorProps) {
  return <MarkdownEditorInner {...props} />
}
