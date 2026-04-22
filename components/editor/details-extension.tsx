"use client"

import { useState } from "react"
import { Node, mergeAttributes } from "@tiptap/core"
import { NodeViewContent, NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react"
import type { NodeViewProps } from "@tiptap/core"
import { Trash2 } from "lucide-react"

function DetailsNodeView({ node, updateAttributes, deleteNode }: NodeViewProps) {
  const [summary, setSummary] = useState<string>((node.attrs.summary as string) || "点击展开")
  const isOpen = node.attrs.open as boolean

  function toggleOpen() {
    const next = !isOpen
    updateAttributes({ open: next })
  }

  return (
    <NodeViewWrapper className="tiptap-details my-3">
      <div className="tiptap-details-header" contentEditable={false}>
        <button
          type="button"
          onClick={toggleOpen}
          className="tiptap-details-toggle"
          aria-label={isOpen ? "折叠" : "展开"}
        >
          {isOpen ? "▾" : "▸"}
        </button>
        <input
          type="text"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          onBlur={() => updateAttributes({ summary })}
          className="tiptap-details-summary-input"
          placeholder="折叠块标题..."
        />
        <button
          type="button"
          onClick={() => deleteNode()}
          className="tiptap-details-delete"
          aria-label="删除折叠块"
          title="删除折叠块"
        >
          <Trash2 size={13} />
        </button>
      </div>
      {isOpen && (
        <div className="tiptap-details-content">
          <NodeViewContent />
        </div>
      )}
    </NodeViewWrapper>
  )
}

type SerState = {
  write: (s: string) => void
  closeBlock: (n: unknown) => void
  renderContent: (n: unknown) => void
}
type SerNode = { attrs: Record<string, unknown> }

export const Details = Node.create({
  name: "details",
  group: "block",
  content: "block+",
  defining: true,
  isolating: true,

  addAttributes() {
    return {
      open: {
        default: true,
        parseHTML: (el) => (el as HTMLElement).hasAttribute("open"),
        renderHTML: (attrs) => (attrs.open ? { open: "" } : {}),
      },
      summary: {
        default: "点击展开",
        parseHTML: (el) =>
          (el as HTMLElement).querySelector("summary")?.textContent?.trim() || "点击展开",
        renderHTML: () => ({}),
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: "details",
        contentElement: (dom) => {
          const el = dom as HTMLElement
          const existing = el.querySelector("div")
          if (existing) return existing
          const wrapper = document.createElement("div")
          Array.from(el.childNodes).forEach((child) => {
            if ((child as Element).tagName?.toLowerCase() !== "summary") {
              wrapper.appendChild(child.cloneNode(true))
            }
          })
          return wrapper
        },
      },
    ]
  },

  renderHTML({ HTMLAttributes, node }) {
    return [
      "details",
      mergeAttributes(HTMLAttributes, (node.attrs.open as boolean) ? { open: "" } : {}),
      ["summary", {}, (node.attrs.summary as string) || "点击展开"],
      ["div", {}, 0],
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(DetailsNodeView)
  },

  addStorage() {
    return {
      markdown: {
        serialize(state: SerState, node: SerNode) {
          const openAttr = node.attrs.open ? " open" : ""
          const summaryText = (node.attrs.summary as string) || "点击展开"
          state.write(`<details${openAttr}>\n<summary>${summaryText}</summary>\n\n`)
          state.renderContent(node)
          state.write("\n</details>")
          state.closeBlock(node)
        },
        parse: {},
      },
    }
  },
})
