import "server-only"

// XeLaTeX runs with -no-shell-escape (see compiler-runner), so shell execution
// is already off the table. This blocklist is the second line of defense: the
// AI-authored body must still NOT perform file I/O, load packages, or break out
// of the document the template owns. Anything matching a dangerous primitive is
// rejected before compilation.
const DANGEROUS_PATTERNS: Array<{ re: RegExp, label: string }> = [
  { re: /\\write\s*18/i, label: "\\write18 (shell execution)" },
  { re: /\\ShellEscape/i, label: "\\ShellEscape" },
  { re: /\\directlua/i, label: "\\directlua" },
  { re: /\\luaexec/i, label: "\\luaexec" },
  { re: /\\write\b/i, label: "\\write (stream write)" },
  { re: /\\openin\b/i, label: "\\openin" },
  { re: /\\openout\b/i, label: "\\openout" },
  { re: /\\read\b/i, label: "\\read" },
  { re: /\\input\b/i, label: "\\input" },
  { re: /\\include\b/i, label: "\\include" },
  { re: /\\InputIfFileExists/i, label: "\\InputIfFileExists" },
  { re: /\\usepackage/i, label: "\\usepackage (body must not load packages)" },
  { re: /\\RequirePackage/i, label: "\\RequirePackage" },
  { re: /\\catcode/i, label: "\\catcode" },
  { re: /\\special\b/i, label: "\\special" },
  { re: /\\csname\b/i, label: "\\csname" },
  { re: /\\documentclass/i, label: "\\documentclass (owned by the template)" },
  { re: /\\begin\s*\{\s*document\s*\}/i, label: "\\begin{document}" },
  { re: /\\end\s*\{\s*document\s*\}/i, label: "\\end{document}" },
  { re: /\.\.[\\/]/, label: "parent-directory path (..)" },
]

export type LatexSanitizeResult = { ok: true } | { ok: false, label: string }

export function sanitizeLatexBody(body: string): LatexSanitizeResult {
  for (const { re, label } of DANGEROUS_PATTERNS) {
    if (re.test(body)) return { ok: false, label }
  }
  return { ok: true }
}

// Strip absolute paths / drive letters from a compiler log before showing it to
// the user, so error summaries never leak local filesystem locations.
export function scrubLatexLog(text: string): string {
  return text
    .replace(/[A-Za-z]:[\\/][^\s)"']*/g, "<path>")
    .replace(/\/(?:[^\s)"']+\/)+[^\s)"']*/g, "<path>")
}
