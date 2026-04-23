"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { FolderInput } from "lucide-react"
import { toast } from "sonner"
import { readUserStorage, removeUserStorage, userStorageKey, writeUserStorage } from "@/lib/client-storage"

type FolderOption = {
  id: string
  name: string
}

type PostFolderSelectProps = {
  postId: string
  type: "blog" | "daily" | "reflections" | "notes"
  userId: string
  initialFolderId: string | null
}

const FOLDER_CACHE_TTL_MS = 5 * 60 * 1000

export function PostFolderSelect({ postId, type, userId, initialFolderId }: PostFolderSelectProps) {
  const router = useRouter()
  const [folders, setFolders] = useState<FolderOption[]>([])
  const [folderId, setFolderId] = useState(initialFolderId ?? "")
  const [saving, setSaving] = useState(false)
  const cacheKey = userStorageKey(userId, "article-folders", type)

  useEffect(() => {
    let active = true
    const cached = readUserStorage<FolderOption[]>({ kind: "session", key: cacheKey, userId, ttlMs: FOLDER_CACHE_TTL_MS })
    if (cached) window.setTimeout(() => setFolders(cached), 0)
    fetch(`/api/article-folders?type=${type}`, { cache: "no-store" })
      .then((res) => res.ok ? res.json() : [])
      .then((data) => {
        if (active && Array.isArray(data)) {
          setFolders(data)
          writeUserStorage({ kind: "session", key: cacheKey, userId, value: data })
        }
      })
      .catch(() => null)
    return () => {
      active = false
    }
  }, [cacheKey, type, userId])

  async function updateFolder(nextFolderId: string) {
    setFolderId(nextFolderId)
    setSaving(true)
    try {
      const res = await fetch(`/api/posts/${postId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderId: nextFolderId || null }),
      })
      if (!res.ok) throw new Error()
      removeUserStorage("session", cacheKey)
      toast.success(nextFolderId ? "已加入文件夹" : "已移到未分类")
      router.refresh()
    } catch {
      setFolderId(folderId)
      toast.error("移动文件夹失败")
    } finally {
      setSaving(false)
    }
  }

  return (
    <label className="inline-flex items-center gap-1.5">
      <FolderInput size={14} />
      <span>文件夹</span>
      <select
        value={folderId}
        disabled={saving}
        onChange={(event) => void updateFolder(event.target.value)}
        className="h-7 max-w-40 rounded-[--radius-sm] border border-[--color-border-strong] bg-[--color-bg-surface] px-2 text-xs text-[--color-text-primary] outline-none hover:bg-[--color-bg-hover] focus:border-[--color-text-primary]"
      >
        <option value="">未分类</option>
        {folders.map((folder) => (
          <option key={folder.id} value={folder.id}>{folder.name}</option>
        ))}
      </select>
    </label>
  )
}
