"use client"

import { removeUserStorage, userStorageKey } from "@/lib/client-storage"

export function getClipboardImageFiles(data: DataTransfer | null): File[] {
  if (!data) return []
  const files: File[] = []
  const items = Array.from(data.items ?? [])

  for (const item of items) {
    if (!item.type.startsWith("image/")) continue
    const file = item.getAsFile()
    if (!file) continue
    const ext = file.type.split("/")[1] || "png"
    const name = file.name?.trim() || `pasted-image-${Date.now()}.${ext}`
    files.push(new File([file], name, { type: file.type, lastModified: Date.now() }))
  }

  return files
}

export function triggerBrowserDownload(url: string, fileName: string) {
  const link = document.createElement("a")
  link.href = url
  link.download = fileName
  link.rel = "noopener"
  document.body.appendChild(link)
  link.click()
  link.remove()
}

export async function copyImageToClipboard(url: string) {
  if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) {
    throw new Error("Clipboard image copy is not supported in this browser.")
  }
  const response = await fetch(url, { cache: "no-store" })
  if (!response.ok) {
    throw new Error("Failed to load image.")
  }
  const blob = await response.blob()
  const mimeType = blob.type || "image/png"
  await navigator.clipboard.write([new ClipboardItem({ [mimeType]: blob })])
}

export async function saveStickerToCustomLibrary(stickerId: string, userId?: string) {
  const form = new FormData()
  form.set("sourceStickerId", stickerId)
  const response = await fetch("/api/stickers", { method: "POST", body: form })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data.error ?? "Failed to save sticker.")
  }
  if (userId) {
    removeUserStorage("local", userStorageKey(userId, "stickers-cache", "picker"))
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("stickers-updated"))
  }
  return data as { deduped?: boolean }
}
