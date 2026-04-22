import { mergeAttributes } from "@tiptap/core"
import { Table } from "@tiptap/extension-table"

export type TableVariant = "default" | "bordered" | "striped" | "minimal" | "card"

export const TABLE_VARIANTS: { value: TableVariant; label: string }[] = [
  { value: "default", label: "默认" },
  { value: "bordered", label: "边框" },
  { value: "striped", label: "斑马纹" },
  { value: "minimal", label: "极简" },
  { value: "card", label: "卡片" },
]

export const TableVariantExtension = Table.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      variant: {
        default: "default" as TableVariant,
        parseHTML: (element) => (element.getAttribute("data-variant") as TableVariant) || "default",
        renderHTML: (attributes) => ({ "data-variant": attributes.variant || "default" }),
      },
    }
  },

  renderHTML({ HTMLAttributes }) {
    return ["table", mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), ["tbody", 0]]
  },
})
