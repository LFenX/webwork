"use client"

import { Node, mergeAttributes } from "@tiptap/core"
import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react"

function PageBreakView() {
  return (
    <NodeViewWrapper>
      <div className="page-break" contentEditable={false} />
    </NodeViewWrapper>
  )
}

type SerState = { write: (s: string) => void; closeBlock: (n: unknown) => void }

export const PageBreak = Node.create({
  name: "pageBreak",
  group: "block",
  atom: true,

  parseHTML() {
    return [
      { tag: 'div[class="page-break"]' },
      { tag: "div.page-break" },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { class: "page-break" })]
  },

  addNodeView() {
    return ReactNodeViewRenderer(PageBreakView)
  },

  addStorage() {
    return {
      markdown: {
        serialize(state: SerState, node: unknown) {
          state.write('<div class="page-break"></div>')
          state.closeBlock(node)
        },
        parse: {},
      },
    }
  },
})
