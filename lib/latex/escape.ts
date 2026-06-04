import "server-only"

// Shared LaTeX escaping for document-info fields (title/subtitle/author/date)
// that templates and themes interpolate into the preamble and cover. The body
// itself is authored as LaTeX by the model and is not escaped here.
export function escapeLatex(value: string): string {
  return value
    .replace(/\\/g, "\\textbackslash{}")
    .replace(/([#$%&_{}])/g, "\\$1")
    .replace(/~/g, "\\textasciitilde{}")
    .replace(/\^/g, "\\textasciicircum{}")
}

// A short, escaped label for the running header (truncated so it never wraps).
export function headerLabel(title: string): string {
  const trimmed = title.trim() || "文档"
  return escapeLatex(trimmed.length > 36 ? `${trimmed.slice(0, 35)}…` : trimmed)
}
