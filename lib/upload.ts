import { randomBytes } from "node:crypto"

export const MAX_IMAGE_UPLOAD_SIZE = 5 * 1024 * 1024
export const MAX_PDF_UPLOAD_SIZE = 50 * 1024 * 1024
export const MAX_UPLOAD_SIZE = MAX_IMAGE_UPLOAD_SIZE
export const USER_QUOTA = 200 * 1024 * 1024
export const PDF_MIME_TYPE = "application/pdf"
export const ALLOWED_IMAGE_MIME = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"])
export const ALLOWED_MIME = new Set([...ALLOWED_IMAGE_MIME, PDF_MIME_TYPE])

const ALLOWED_EXT = /^\.(png|jpe?g|webp|gif|pdf)$/i
const IMAGE_EXT = /^\.(png|jpe?g|webp|gif)$/i

export function generateFilename(originalName: string): string {
  const ext = (originalName.match(/\.[a-zA-Z0-9]+$/)?.[0] ?? "").toLowerCase()
  const safeExt = ALLOWED_EXT.test(ext) ? ext : ".bin"
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "")
  return `${date}-${randomBytes(4).toString("hex")}${safeExt}`
}

export function isPdfFileLike(file: Pick<File, "name" | "type">) {
  return file.type === PDF_MIME_TYPE || /\.pdf$/i.test(file.name)
}

export function isAllowedUploadFile(file: Pick<File, "name" | "type">) {
  if (isPdfFileLike(file)) return true
  return ALLOWED_IMAGE_MIME.has(file.type)
}

export function getUploadMaxSize(file: Pick<File, "name" | "type">) {
  return isPdfFileLike(file) ? MAX_PDF_UPLOAD_SIZE : MAX_IMAGE_UPLOAD_SIZE
}

export function getUploadKind(file: Pick<File, "name" | "type">) {
  return isPdfFileLike(file) ? "pdf" : "image"
}

export function isSafeImageFilename(filename: string) {
  const ext = (filename.match(/\.[a-zA-Z0-9]+$/)?.[0] ?? "").toLowerCase()
  return IMAGE_EXT.test(ext)
}

export const UPLOAD_ERROR_MESSAGES: Record<string, string> = {
  unauthorized: "Please sign in first",
  no_file: "Please choose a file",
  invalid_mime: "Only PNG, JPEG, WebP, GIF, and PDF files are supported",
  invalid_pdf: "Invalid PDF file",
  too_large: "File exceeds upload size limit",
  quota_exceeded: "Storage quota exceeded",
}
