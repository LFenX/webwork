"use client"

import { toast } from "sonner"

const SENSITIVE_PATTERNS = [
  /sk-[A-Za-z0-9_-]{12,}/g,
  /postgres(?:ql)?:\/\/\S+/gi,
  /DATABASE_URL\s*=\s*\S+/gi,
  /api[_-]?key\s*[:=]\s*\S+/gi,
  /Bearer\s+[A-Za-z0-9._-]+/g,
]

export function safeErrorMessage(error: unknown, fallback = "操作失败，请稍后重试") {
  const raw = error instanceof Error ? error.message : typeof error === "string" ? error : fallback
  const sanitized = SENSITIVE_PATTERNS.reduce((message, pattern) => message.replace(pattern, "[已隐藏]"), raw)
  return sanitized.length > 220 ? fallback : sanitized || fallback
}

export function showErrorToast(error: unknown, fallback?: string) {
  toast.error(safeErrorMessage(error, fallback))
}

export function confirmAction(message: string, cancelMessage = "已取消操作") {
  if (typeof window === "undefined") return false
  const confirmed = window.confirm(message)
  if (!confirmed && cancelMessage) toast.info(cancelMessage)
  return confirmed
}

export async function copyTextWithToast(
  text: string,
  successMessage = "已复制",
  failureMessage = "复制失败，请手动复制",
) {
  try {
    await navigator.clipboard.writeText(text)
    toast.success(successMessage)
    return true
  } catch {
    toast.error(failureMessage)
    return false
  }
}
