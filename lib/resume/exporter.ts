import "server-only"
import path from "node:path"
import type { ResumeJson } from "./types"

export const RESUME_JSON_PDF_DIR_REL = "uploads/resumes-json"

export function buildExportPdfPublicPath(userId: string): string {
  return `/${RESUME_JSON_PDF_DIR_REL}/${encodeURIComponent(userId)}/current.pdf`
}
export function buildExportPdfFilesystemPath(userId: string): string {
  return path.join(process.cwd(), "public", RESUME_JSON_PDF_DIR_REL, userId, "current.pdf")
}

export interface ExportPdfInput { userId: string; resumeJson: ResumeJson; selectedTheme: string | null }
export interface ExportPdfResult { pdfPath: string; exportedAt: Date }

export async function exportResumePdf(_input: ExportPdfInput): Promise<ExportPdfResult> {
  throw Object.assign(new Error("PDF_EXPORT_NOT_IMPLEMENTED"), { code: "NOT_IMPLEMENTED" })
}
