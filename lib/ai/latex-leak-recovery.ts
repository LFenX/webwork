import "server-only"
import { DEFAULT_LATEX_TEMPLATE, LATEX_TEMPLATE_IDS } from "@/lib/latex/templates"

// Some models (e.g. weaker DeepSeek-compatible endpoints) emit a tool call as
// plain text instead of a structured `tool_calls` object, so the platform never
// executes it and the raw arguments — here a wall of LaTeX — leak into the chat.
// These helpers detect that specific failure for compile_latex_pdf and recover
// the call so we can still produce the PDF the user asked for.

// Fullwidth vertical bar (U+FF5C) used by the leaked DeepSeek markup.
const DSML_MARKUP = /<\/?[^>]*｜｜?DSML[^>]*>/g

export function looksLikeLeakedLatexCall(text: string): boolean {
  if (!text) return false
  // ONLY the unambiguous leaked-markup signatures count as a leak. A normal
  // answer that merely mentions the tool name or shows LaTeX (e.g. explaining
  // what it will do) must NOT be mistaken for a leaked call — otherwise we would
  // suppress the real streaming and recover a sparse body from the narration.
  return /｜｜DSML｜｜/.test(text) || /<\s*invoke\s+name\s*=\s*["']?compile_latex_pdf/.test(text)
}

export type RecoveredLatexCall = { template: string, title: string, bodyLatex: string }

export function recoverCompileLatexCall(text: string): RecoveredLatexCall | null {
  if (!text) return null
  const foundId = LATEX_TEMPLATE_IDS.find((id) => text.includes(id))

  // Body starts right after the template id when present; otherwise after the
  // first LaTeX command we can find. Template defaults to the academic one.
  let start = 0
  if (foundId) {
    start = text.indexOf(foundId) + foundId.length
  } else {
    const cmd = text.search(/\\(section|subsection|begin|textbf)/)
    if (cmd >= 0) start = cmd
  }
  let body = text.slice(start)
  body = body
    .replace(DSML_MARKUP, "")
    .replace(/<\/?\s*invoke[^>]*>/gi, "")
    .replace(/<\/?[^>]*tool_calls[^>]*>/gi, "")
    .replace(/<\/?｜[^>]*>/g, "")
    .trim()

  // Require it to actually look like LaTeX body content, otherwise bail.
  if (!/\\(section|subsection|begin|textbf|item)/.test(body)) return null

  const template = foundId || DEFAULT_LATEX_TEMPLATE
  const title = body.match(/\\section\*?\{([^}]{1,80})\}/)?.[1]?.trim() || "综合报告"
  return { template, title, bodyLatex: body }
}
