"use client"

import { Node, mergeAttributes } from "@tiptap/core"
import { NodeViewContent, NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react"

export type CalloutType = "note" | "tip" | "warning" | "important"

const CALLOUT_LABELS: Record<CalloutType, string> = {
  note: "NOTE",
  tip: "TIP",
  warning: "WARNING",
  important: "IMPORTANT",
}

function CalloutView({ node }: { node: { attrs: { type?: CalloutType } } }) {
  const type = node.attrs.type || "note"

  return (
    <NodeViewWrapper className={`markdown-alert markdown-alert-${type}`}>
      <div className="markdown-alert-title" contentEditable={false}>
        {CALLOUT_LABELS[type]}
      </div>
      <NodeViewContent />
    </NodeViewWrapper>
  )
}

type SerState = {
  write: (content: string) => void
  closeBlock: (node: unknown) => void
  renderContent: (node: unknown) => void
}

type SerNode = {
  attrs: { type?: CalloutType }
}

export const Callout = Node.create({
  name: "callout",
  group: "block",
  content: "block+",
  defining: true,

  addAttributes() {
    return {
      type: {
        default: "note" as CalloutType,
        parseHTML: (element) => {
          const className = element.getAttribute("class") || ""
          if (className.includes("markdown-alert-tip")) return "tip"
          if (className.includes("markdown-alert-warning")) return "warning"
          if (className.includes("markdown-alert-important")) return "important"
          return "note"
        },
        renderHTML: (attributes) => ({
          class: `markdown-alert markdown-alert-${attributes.type || "note"}`,
        }),
      },
    }
  },

  parseHTML() {
    return [{ tag: "div.markdown-alert" }]
  },

  renderHTML({ HTMLAttributes, node }) {
    const type = (node.attrs.type as CalloutType | undefined) || "note"
    return [
      "div",
      mergeAttributes(HTMLAttributes, { class: `markdown-alert markdown-alert-${type}` }),
      ["div", { class: "markdown-alert-title" }, CALLOUT_LABELS[type]],
      ["div", {}, 0],
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(CalloutView)
  },

  addStorage() {
    return {
      markdown: {
        serialize(state: SerState, node: SerNode) {
          const type = node.attrs.type || "note"
          state.write(`<div class="markdown-alert markdown-alert-${type}">\n<div class="markdown-alert-title">${CALLOUT_LABELS[type]}</div>\n\n`)
          state.renderContent(node)
          state.write("\n</div>")
          state.closeBlock(node)
        },
        parse: {},
      },
    }
  },
})
