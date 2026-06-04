import "server-only"
import path from "node:path"

export const PDF_PARSE_QUALITY = process.env.PDF_PARSE_QUALITY?.trim() || "highest"
export const PDF_PARSE_TIMEOUT_MS = Number(process.env.PDF_PARSE_TIMEOUT_MS || 10 * 60 * 1000)
export const PDF_MAX_PAGES = Number(process.env.PDF_MAX_PAGES || 300)
export const PDF_CONTEXT_MAX_CHARS = Number(process.env.PDF_CONTEXT_MAX_CHARS || 14_000)

export function getPdfOutputDir(userId: string, documentId: string) {
  return path.join(process.cwd(), "storage", "pdf", userId, documentId)
}

export function getPdfParserScriptPath() {
  return path.join(process.cwd(), "scripts", "pdf-parser", "parse_pdf.py")
}
