import { mergeAttributes } from "@tiptap/core"
import { HorizontalRule } from "@tiptap/extension-horizontal-rule"

export type HRVariant = "plain" | "dashed" | "dotted" | "double" | "thick" | "wavy" | "ornament"

export const HR_VARIANTS: { value: HRVariant; label: string; preview: string }[] = [
  { value: "plain",    label: "直线",  preview: "─────" },
  { value: "dashed",   label: "虚线",  preview: "- - -" },
  { value: "dotted",   label: "点线",  preview: "·····" },
  { value: "double",   label: "双线",  preview: "═════" },
  { value: "thick",    label: "粗线",  preview: "━━━━━" },
  { value: "wavy",     label: "波浪线", preview: "~~~~~" },
  { value: "ornament", label: "装饰线", preview: "⋯✦⋯" },
]

type SerState = {
  write: (s: string) => void
  closeBlock: (n: unknown) => void
}
type SerNode = { attrs: Record<string, string> }

export const HorizontalRuleVariant = HorizontalRule.extend({
  addAttributes() {
    return {
      variant: {
        default: "plain" as HRVariant,
        parseHTML: (el) => (el.getAttribute("data-variant") as HRVariant) || "plain",
        renderHTML: (attrs) => ({ "data-variant": attrs.variant }),
      },
    }
  },

  renderHTML({ HTMLAttributes }) {
    return ["hr", mergeAttributes(HTMLAttributes)]
  },

  addStorage() {
    return {
      markdown: {
        serialize(state: SerState, node: SerNode) {
          const v = node.attrs.variant || "plain"
          if (v === "plain") {
            state.write("---")
          } else {
            state.write(`<hr data-variant="${v}" />`)
          }
          state.closeBlock(node)
        },
        parse: {},
      },
    }
  },
})
