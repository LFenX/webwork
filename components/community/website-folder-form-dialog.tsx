"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { confirmAction } from "@/lib/interaction-feedback"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import type { FolderItem } from "./website-share-client"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  editingFolder: FolderItem | null
  onSuccess: () => void
}

export function WebsiteFolderFormDialog({ open, onOpenChange, editingFolder, onSuccess }: Props) {
  const isEditing = !!editingFolder
  const [name, setName] = useState(editingFolder?.name || "")
  const [description, setDescription] = useState(editingFolder?.description || "")
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async () => {
    if (!name.trim()) { setError("请输入文件夹名称"); return }
    if (name.trim().length > 30) { setError("文件夹名称最多 30 个字符"); return }

    setSubmitting(true)
    const method = isEditing ? "PATCH" : "POST"
    const endpoint = isEditing
      ? `/api/website-folders/${editingFolder!.id}`
      : "/api/website-folders"

    try {
      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), description: description.trim() }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setError(err.error ?? "操作失败")
        return
      }
      toast.success(isEditing ? "文件夹已更新" : "文件夹已创建")
      onSuccess()
    } catch (error) {
      const message = error instanceof Error ? error.message : "操作失败"
      setError(message)
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!editingFolder) return
    if (!confirmAction(`确定删除文件夹「${editingFolder.name}」？里面的网站不会被删除，但会回到未归类列表。`)) return

    setDeleting(true)
    try {
      const res = await fetch(`/api/website-folders/${editingFolder.id}`, { method: "DELETE" })
      if (!res.ok) {
        toast.error("删除失败")
        return
      }
      toast.success("文件夹已删除")
      onSuccess()
    } catch { toast.error("删除失败") }
    finally { setDeleting(false) }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} key={editingFolder?.id ?? "new"}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? "编辑文件夹" : "新建文件夹"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Input
              value={name}
              onChange={(e) => { setName(e.target.value); setError("") }}
              placeholder="文件夹名称"
              maxLength={30}
              autoFocus
            />
            {error && <p className="mt-1 text-xs text-[--color-danger]">{error}</p>}
          </div>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="文件夹描述（可选）"
            rows={2}
            maxLength={200}
          />
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button className="flex-1" onClick={handleSubmit} loading={submitting} loadingText={isEditing ? "保存中..." : "创建中..."}>
              {isEditing ? "保存" : "创建"}
            </Button>
          </div>
          {isEditing && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              aria-busy={deleting || undefined}
              className="w-full rounded-full py-2 text-center text-xs text-[--color-danger] transition-colors hover:bg-[--color-danger-bg] disabled:opacity-50"
            >
              {deleting ? "删除中..." : "删除此文件夹"}
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
