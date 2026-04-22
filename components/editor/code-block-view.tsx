"use client"

import { NodeViewContent, NodeViewWrapper } from "@tiptap/react"
import type { NodeViewProps } from "@tiptap/core"

const LANGUAGES = [
  "plaintext", "bash", "shell", "powershell",
  "json", "yaml", "toml", "xml", "html", "css", "scss",
  "javascript", "typescript", "jsx", "tsx",
  "python", "java", "c", "cpp", "csharp", "go", "rust",
  "php", "ruby", "kotlin", "swift", "scala",
  "sql", "graphql", "markdown", "diff", "mermaid",
]

const THEMES = [
  { value: "default", label: "Default" },
  { value: "dark", label: "Dark" },
  { value: "github", label: "GitHub" },
  { value: "nord", label: "Nord" },
  { value: "monokai", label: "Monokai" },
] as const

export function CodeBlockView({ node, updateAttributes }: NodeViewProps) {
  const language = (node.attrs.language as string) || "plaintext"
  const theme = (node.attrs.theme as string) || "default"

  return (
    <NodeViewWrapper className="tiptap-code-block relative my-4" data-theme={theme}>
      <div
        className="absolute right-2 top-2 z-10 flex flex-wrap items-center justify-end gap-1"
        contentEditable={false}
      >
        {language !== "plaintext" && (
          <span className="rounded px-1.5 py-0.5 text-[10px] text-white/40 font-mono">
            {language}
          </span>
        )}
        <select
          value={language}
          onChange={(e) => updateAttributes({ language: e.target.value })}
          className="rounded border border-white/20 bg-white/10 px-1.5 py-0.5 text-[10px] text-white/70 cursor-pointer hover:bg-white/20 focus:outline-none focus:border-white/40"
        >
          {LANGUAGES.map((lang) => (
            <option key={lang} value={lang} className="bg-[#1e1e2e] text-white">
              {lang}
            </option>
          ))}
        </select>
        <select
          value={theme}
          onChange={(e) => updateAttributes({ theme: e.target.value })}
          className="rounded border border-white/20 bg-white/10 px-1.5 py-0.5 text-[10px] text-white/70 cursor-pointer hover:bg-white/20 focus:outline-none focus:border-white/40"
          title="代码块主题"
        >
          {THEMES.map((item) => (
            <option key={item.value} value={item.value} className="bg-[#1e1e2e] text-white">
              {item.label}
            </option>
          ))}
        </select>
      </div>
      <pre className="tiptap-code-block-pre">
        <NodeViewContent />
      </pre>
    </NodeViewWrapper>
  )
}
