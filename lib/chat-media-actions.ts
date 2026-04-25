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
  const result = await saveStickersToCustomLibrary([stickerId], userId)
  return { deduped: result.dedupedCount > 0 }
}

export async function saveStickersToCustomLibrary(stickerIds: string[], userId?: string) {
  const uniqueIds = [...new Set(stickerIds.filter(Boolean))]
  if (uniqueIds.length === 0) {
    return { addedCount: 0, dedupedCount: 0 }
  }
  const form = new FormData()
  form.set("action", "save-to-custom")
  uniqueIds.forEach((id) => form.append("sourceStickerIds", id))
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
  return {
    addedCount: Number(data.addedCount ?? 0),
    dedupedCount: Number(data.dedupedCount ?? 0),
  }
}

export async function contributeStickersToCommunity(stickerIds: string[], userId?: string) {
  const uniqueIds = [...new Set(stickerIds.filter(Boolean))]
  if (uniqueIds.length === 0) {
    return { addedCount: 0, dedupedCount: 0 }
  }
  const form = new FormData()
  form.set("action", "contribute-to-public")
  uniqueIds.forEach((id) => form.append("contributeStickerIds", id))
  const response = await fetch("/api/stickers", { method: "POST", body: form })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data.error ?? "Failed to contribute stickers.")
  }
  if (userId) {
    removeUserStorage("local", userStorageKey(userId, "stickers-cache", "picker"))
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("stickers-updated"))
  }
  return {
    addedCount: Number(data.addedCount ?? 0),
    dedupedCount: Number(data.dedupedCount ?? 0),
  }
}

export async function createStickerGroup(name: string, scope: string, userId?: string) {
  const form = new FormData()
  form.set("action", "create")
  form.set("name", name)
  form.set("scope", scope)
  const res = await fetch("/api/stickers/groups", { method: "POST", body: form })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? "创建分组失败")
  if (userId) removeUserStorage("local", userStorageKey(userId, "stickers-cache", "picker"))
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("stickers-updated"))
  return data.group
}

export async function renameStickerGroup(groupId: string, name: string, userId?: string) {
  const form = new FormData()
  form.set("action", "rename")
  form.set("groupId", groupId)
  form.set("name", name)
  const res = await fetch("/api/stickers/groups", { method: "POST", body: form })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? "重命名分组失败")
  if (userId) removeUserStorage("local", userStorageKey(userId, "stickers-cache", "picker"))
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("stickers-updated"))
}

export async function deleteStickerGroup(groupId: string, userId?: string) {
  const form = new FormData()
  form.set("action", "delete")
  form.set("groupId", groupId)
  const res = await fetch("/api/stickers/groups", { method: "POST", body: form })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? "删除分组失败")
  if (userId) removeUserStorage("local", userStorageKey(userId, "stickers-cache", "picker"))
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("stickers-updated"))
}

export async function addStickersToGroup(groupId: string, stickerIds: string[], userId?: string) {
  const form = new FormData()
  form.set("action", "add-stickers")
  form.set("groupId", groupId)
  stickerIds.forEach((id) => form.append("stickerIds", id))
  const res = await fetch("/api/stickers/groups", { method: "POST", body: form })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? "添加到分组失败")
  if (userId) removeUserStorage("local", userStorageKey(userId, "stickers-cache", "picker"))
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("stickers-updated"))
  return data.addedCount as number
}

export async function removeStickersFromGroup(groupId: string, stickerIds: string[], userId?: string) {
  const form = new FormData()
  form.set("action", "remove-stickers")
  form.set("groupId", groupId)
  stickerIds.forEach((id) => form.append("stickerIds", id))
  const res = await fetch("/api/stickers/groups", { method: "POST", body: form })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? "从分组移出失败")
  if (userId) removeUserStorage("local", userStorageKey(userId, "stickers-cache", "picker"))
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("stickers-updated"))
}
