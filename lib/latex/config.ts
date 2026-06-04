import "server-only"
import path from "node:path"

// LaTeX compile is a deliberate, user-initiated action, so it runs synchronously
// inside the tool call with a bounded timeout rather than as a background job.
// Per-pass timeout. Raised to accommodate long (dozens–hundreds of pages) drafts;
// override via env for even larger documents.
export const LATEX_COMPILE_TIMEOUT_MS = Number(process.env.LATEX_COMPILE_TIMEOUT_MS || 150_000)
// Max assembled body. Raised so a chunk-built long document (hundreds of pages)
// fits; still a safety bound.
export const LATEX_MAX_BODY_CHARS = Number(process.env.LATEX_MAX_BODY_CHARS || 500_000)
export const LATEX_MAX_PDF_BYTES = Number(process.env.LATEX_MAX_PDF_BYTES || 30 * 1024 * 1024)
// Generated PDFs are ephemeral: their files are auto-deleted after this window.
export const LATEX_PDF_TTL_MS = Number(process.env.LATEX_PDF_TTL_MS || 24 * 60 * 60 * 1000)
// Upload.kind marker that distinguishes a compiled (ephemeral) PDF from a user upload.
export const LATEX_PDF_KIND = "latex-pdf"

export function getLatexBuildDir(userId: string, jobId: string) {
  return path.join(process.cwd(), "storage", "latex", userId, jobId)
}

export function getLatexUploadDir(userId: string) {
  return path.join(process.cwd(), "storage", "uploads", userId)
}

export function resolveXelatexCommand() {
  return process.env.LATEX_XELATEX_PATH?.trim() || "xelatex"
}
