"use client"

import { useState } from "react"
import { Check, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { MessageActionSurface, type MessageActionItem } from "@/components/chat-message-actions"
import { UserAvatar } from "@/components/user-avatar"
import { Button } from "@/components/ui/button"
import { saveStickerToCustomLibrary, saveStickersToCustomLibrary } from "@/lib/chat-media-actions"

type StickerContributor = {
  id: string
  email: string
  displayName: string
  avatarText: string
  avatarUrl: string | null
}

type StickerAsset = {
  id: string
  name: string
  originalName: string
  mimeType: string
  size: number
  isAnimated: boolean
  url: string
}

type PublicStickerGroup = {
  contributor: StickerContributor
  stickers: StickerAsset[]
}

function StickerCard({
  sticker,
  selectable,
  selected,
  onClick,
  contextItems,
}: {
  sticker: StickerAsset
  selectable: boolean
  selected: boolean
  onClick: () => void
  contextItems: MessageActionItem[]
}) {
  const tile = (
    <button
      type="button"
      onClick={onClick}
      className="group relative flex aspect-square items-center justify-center overflow-hidden rounded-2xl border border-[--color-border] bg-white hover:border-[--color-accent]"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={sticker.url} alt={sticker.name || sticker.originalName} className="h-full w-full object-cover" />
      {selectable ? (
        <span className={`absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full border ${selected ? "border-[#2563eb] bg-[#2563eb] text-white" : "border-white bg-black/35 text-transparent"}`}>
          <Check size={14} />
        </span>
      ) : null}
    </button>
  )

  if (selectable || contextItems.length === 0) return tile

  return (
    <MessageActionSurface
      className="block"
      items={contextItems}
      preview={(
        <div className="p-3">
          <div className="overflow-hidden rounded-xl bg-white p-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={sticker.url} alt={sticker.name || sticker.originalName} className="block max-h-[280px] max-w-full object-contain" />
          </div>
        </div>
      )}
    >
      {tile}
    </MessageActionSurface>
  )
}

export function StickerCommunityBrowser({ groups, userId }: { groups: PublicStickerGroup[]; userId: string }) {
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [deleteMode, setDeleteMode] = useState(false)
  const [deleteSelectedIds, setDeleteSelectedIds] = useState<string[]>([])
  const [deleting, setDeleting] = useState(false)

  const ownStickerIds = new Set(
    groups
      .filter((g) => g.contributor.id === userId)
      .flatMap((g) => g.stickers.map((s) => s.id))
  )

  const toggleSelected = (stickerId: string) => {
    setSelectedIds((current) => (
      current.includes(stickerId)
        ? current.filter((id) => id !== stickerId)
        : [...current, stickerId]
    ))
  }

  const toggleDeleteSelected = (stickerId: string) => {
    setDeleteSelectedIds((current) => (
      current.includes(stickerId)
        ? current.filter((id) => id !== stickerId)
        : [...current, stickerId]
    ))
  }

  async function handleAddSingle(stickerId: string) {
    try {
      const result = await saveStickerToCustomLibrary(stickerId, userId)
      toast.success(result.deduped ? "该表情已在我的表情中" : "已添加到我的表情")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "添加表情失败")
    }
  }

  async function handleDeleteSingle(stickerId: string) {
    try {
      const form = new FormData()
      form.set("action", "delete-public")
      form.append("deleteStickerIds", stickerId)
      const res = await fetch("/api/stickers", { method: "POST", body: form })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? "删除表情失败")
      toast.success("表情已移除")
      window.dispatchEvent(new CustomEvent("stickers-updated"))
      window.location.reload()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "删除表情失败")
    }
  }

  async function handleAddSelected() {
    if (selectedIds.length === 0) return
    setSaving(true)
    try {
      const result = await saveStickersToCustomLibrary(selectedIds, userId)
      toast.success(result.addedCount > 0 ? `已添加 ${result.addedCount} 个表情到我的表情` : "选中的表情都已在我的表情中")
      setSelectionMode(false)
      setSelectedIds([])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "添加表情失败")
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteSelected() {
    if (deleteSelectedIds.length === 0) return
    setDeleting(true)
    try {
      const form = new FormData()
      form.set("action", "delete-public")
      deleteSelectedIds.forEach((id) => form.append("deleteStickerIds", id))
      const res = await fetch("/api/stickers", { method: "POST", body: form })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? "删除表情失败")
      toast.success(`已移除 ${Number(data.deletedCount ?? 0) + Number(data.archivedCount ?? 0)} 个表情`)
      setDeleteMode(false)
      setDeleteSelectedIds([])
      window.dispatchEvent(new CustomEvent("stickers-updated"))
      window.location.reload()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "删除表情失败")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface] p-4">
        <div>
          <h1 className="text-lg font-semibold text-[--color-text-primary]">社区表情包</h1>
          <p className="text-sm text-[--color-text-muted]">按贡献者查看公用表情，并可批量添加到我的表情。</p>
        </div>
        <div className="flex gap-2">
          {deleteMode ? (
            <>
              <Button type="button" variant="outline" onClick={() => { setDeleteMode(false); setDeleteSelectedIds([]) }}>
                取消
              </Button>
              <Button type="button" variant="destructive" onClick={() => void handleDeleteSelected()} disabled={deleting || deleteSelectedIds.length === 0}>
                确定删除
              </Button>
            </>
          ) : selectionMode ? (
            <>
              <Button type="button" variant="outline" onClick={() => { setSelectionMode(false); setSelectedIds([]) }}>
                取消
              </Button>
              <Button type="button" onClick={() => void handleAddSelected()} disabled={saving || selectedIds.length === 0}>
                确定添加
              </Button>
            </>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={() => setSelectionMode(true)}>
                批量添加到我的表情
              </Button>
              {ownStickerIds.size > 0 ? (
                <Button type="button" variant="outline" className="gap-1.5 text-[--color-danger]" onClick={() => setDeleteMode(true)}>
                  <Trash2 size={14} />
                  删除我的贡献
                </Button>
              ) : null}
            </>
          )}
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface] p-10 text-center text-sm text-[--color-text-muted]">
          公用表情包库暂无内容
        </div>
      ) : null}

      {groups.map((group) => (
          <section key={group.contributor.id} className="rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface] p-4">
            <div className="mb-4 flex items-center gap-3">
              <UserAvatar
                size="sm"
                name={group.contributor.displayName}
                email={group.contributor.email}
                avatarText={group.contributor.avatarText}
                avatarUrl={group.contributor.avatarUrl}
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-[--color-text-primary]">{group.contributor.displayName || group.contributor.email}</p>
                <p className="truncate text-xs text-[--color-text-muted]">贡献的表情包</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
              {group.stickers.map((sticker) => {
                const isOwn = ownStickerIds.has(sticker.id)
                const contextItems: MessageActionItem[] = [
                  {
                    id: "save-to-custom",
                    label: "添加到我的表情",
                    onSelect: () => { void handleAddSingle(sticker.id) },
                  },
                  ...(isOwn ? [{
                    id: "delete-public",
                    label: "删除",
                    onSelect: () => { void handleDeleteSingle(sticker.id) },
                  }] : []),
                ]
                return (
                  <StickerCard
                    key={sticker.id}
                    sticker={sticker}
                    selectable={selectionMode || (deleteMode && isOwn)}
                    selected={selectionMode ? selectedIds.includes(sticker.id) : deleteMode ? deleteSelectedIds.includes(sticker.id) : false}
                    contextItems={contextItems}
                    onClick={() => {
                      if (selectionMode) {
                        toggleSelected(sticker.id)
                      } else if (deleteMode && isOwn) {
                        toggleDeleteSelected(sticker.id)
                      }
                    }}
                  />
                )
              })}
            </div>
          </section>
        ))}
    </div>
  )
}
