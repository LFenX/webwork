import { randomBytes } from "node:crypto"

export const MAX_UPLOAD_SIZE = 5 * 1024 * 1024
export const USER_QUOTA = 200 * 1024 * 1024
export const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"])

const ALLOWED_EXT = /^\.(png|jpe?g|webp|gif)$/i

export function generateFilename(originalName: string): string {
  const ext = (originalName.match(/\.[a-zA-Z0-9]+$/)?.[0] ?? "").toLowerCase()
  const safeExt = ALLOWED_EXT.test(ext) ? ext : ".bin"
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "")
  return `${date}-${randomBytes(4).toString("hex")}${safeExt}`
}

export const UPLOAD_ERROR_MESSAGES: Record<string, string> = {
  unauthorized: "请先登录",
  no_file: "请选择文件",
  invalid_mime: "仅支持 PNG、JPEG、WebP、GIF 格式",
  too_large: "图片超过 5 MB 限制",
  quota_exceeded: "已超出 200 MB 存储配额",
}
