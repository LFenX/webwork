"use client"

import Link from "next/link"
import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Check, Loader2, Plus, SmilePlus, Upload, X } from "lucide-react"
import { toast } from "sonner"
import { MessageActionSurface, type MessageActionItem } from "@/components/chat-message-actions"
import { UserAvatar } from "@/components/user-avatar"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  addStickersToGroup,
  contributeStickersToCommunity,
  createStickerGroup,
  deleteStickerGroup,
  removeStickersFromGroup,
  renameStickerGroup,
  saveStickerToCustomLibrary,
  saveStickersToCustomLibrary,
} from "@/lib/chat-media-actions"
import { readUserStorage, removeUserStorage, userStorageKey, writeUserStorage } from "@/lib/client-storage"
import { getDict } from "@/lib/i18n"

export type StickerPick =
  | { type: "emoji"; emoji: string }
  | { type: "asset"; id: string; url: string; name: string; isAnimated: boolean }

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
  contributor?: StickerContributor | null
}

type PublicStickerGroup = {
  contributor: StickerContributor
  stickers: StickerAsset[]
}

const STICKER_CACHE_TTL_MS = 24 * 60 * 60 * 1000

type StickerGroupWithStickers = {
  id: string
  name: string
  stickers: StickerAsset[]
}

type StickerCache = {
  defaults: string[]
  custom: StickerAsset[]
  public: StickerAsset[]
  publicGroups: PublicStickerGroup[]
  customGroups: StickerGroupWithStickers[]
}

function StickerTile({
  sticker,
  selectable,
  selected,
  onClick,
  contextItems,
}: {
  sticker: StickerAsset
  selectable?: boolean
  selected?: boolean
  onClick: () => void
  contextItems?: MessageActionItem[]
}) {
  const tile = (
    <button
      type="button"
      onClick={onClick}
      className="group relative flex aspect-square items-center justify-center overflow-hidden rounded-xl border border-[--color-border] bg-white hover:border-[--color-accent]"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={sticker.url} alt={sticker.name || sticker.originalName} className="h-full w-full object-cover" />
      {selectable ? (
        <span className={`absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full border ${selected ? "border-[#2563eb] bg-[#2563eb] text-white" : "border-white bg-black/35 text-transparent"}`}>
          <Check size={12} />
        </span>
      ) : null}
    </button>
  )

  if (!contextItems || contextItems.length === 0 || selectable) {
    return tile
  }

  return (
    <MessageActionSurface
      className="block"
      items={contextItems}
      preview={(
        <div className="p-3">
          <div className="overflow-hidden rounded-xl bg-white p-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={sticker.url} alt={sticker.name || sticker.originalName} className="block max-h-40 max-w-full object-contain" />
          </div>
        </div>
      )}
    >
      {tile}
    </MessageActionSurface>
  )
}

export function StickerPicker({ onPick, compact = false, userId }: { onPick: (pick: StickerPick) => void; compact?: boolean; userId?: string }) {
  const dict = getDict()
  const st = dict.stickers

  const [open, setOpen] = useState(false)
  const [defaults, setDefaults] = useState<string[]>([])
  const [custom, setCustom] = useState<StickerAsset[]>([])
  const [publicStickers, setPublicStickers] = useState<StickerAsset[]>([])
  const [publicGroups, setPublicGroups] = useState<PublicStickerGroup[]>([])
  const [tab, setTab] = useState<"default" | "custom" | "public">("default")
  const [customGroups, setCustomGroups] = useState<StickerGroupWithStickers[]>([])
  const [groupSelectionMode, setGroupSelectionMode] = useState<string | null>(null)
  const [groupSelectedIds, setGroupSelectedIds] = useState<string[]>([])
  const [creatingGroup, setCreatingGroup] = useState(false)
  const [newGroupName, setNewGroupName] = useState("")
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null)
  const [editGroupName, setEditGroupName] = useState("")
  const [uploadTargetGroup, setUploadTargetGroup] = useState("")
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadFileIndex, setUploadFileIndex] = useState(0)
  const [uploadFileTotal, setUploadFileTotal] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [customSelectionMode, setCustomSelectionMode] = useState(false)
  const [customSelectionAction, setCustomSelectionAction] = useState<"contribute" | "delete">("contribute")
  const [publicSelectionMode, setPublicSelectionMode] = useState(false)
  const [selectedCustomIds, setSelectedCustomIds] = useState<string[]>([])
  const [selectedPublicIds, setSelectedPublicIds] = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const cacheKey = userId ? userStorageKey(userId, "stickers-cache", "picker") : ""

  const load = useCallback(async () => {
    if (cacheKey && userId) {
      const cached = readUserStorage<StickerCache>({ kind: "local", key: cacheKey, userId, ttlMs: STICKER_CACHE_TTL_MS })
      if (cached) {
        setDefaults(cached.defaults)
        setCustom(cached.custom)
        setPublicStickers(cached.public)
        setPublicGroups(cached.publicGroups)
        setCustomGroups(cached.customGroups ?? [])
      }
    }
    const res = await fetch("/api/stickers", { cache: "no-store" })
    if (!res.ok) return
    const data = await res.json()
    const next = {
      defaults: Array.isArray(data.defaults) ? data.defaults : [],
      custom: Array.isArray(data.custom) ? data.custom : [],
      public: Array.isArray(data.public) ? data.public : [],
      publicGroups: Array.isArray(data.publicGroups) ? data.publicGroups : [],
      customGroups: Array.isArray(data.customGroups) ? data.customGroups : [],
    }
    setDefaults(next.defaults)
    setCustom(next.custom)
    setPublicStickers(next.public)
    setPublicGroups(next.publicGroups)
    setCustomGroups(next.customGroups)
    if (cacheKey && userId) writeUserStorage({ kind: "local", key: cacheKey, userId, value: next })
  }, [cacheKey, userId])

  useEffect(() => {
    if (!open) return
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [load, open])

  useEffect(() => {
    const handleUpdated = () => {
      void load()
    }
    window.addEventListener("stickers-updated", handleUpdated)
    return () => window.removeEventListener("stickers-updated", handleUpdated)
  }, [load])

  const communityDisplayName = st.communityStickers
  const defaultTab = st.defaultTab

  const groupedPublic = useMemo(() => {
    if (publicGroups.length > 0) return publicGroups
    return publicStickers.length > 0
      ? [{
          contributor: {
            id: "community",
            email: "",
            displayName: communityDisplayName,
            avatarText: defaultTab,
            avatarUrl: null,
          },
          stickers: publicStickers,
        }]
      : []
  // eslint-disable-next-line react-hooks/preserve-manual-memoization -- i18n strings are stable
  }, [publicGroups, publicStickers, communityDisplayName, defaultTab])

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])
    event.currentTarget.value = ""
    if (files.length === 0) return
    setUploading(true)
    setUploadFileTotal(files.length)
    setUploadFileIndex(0)
    setUploadProgress(0)
    try {
      let createdCount = 0
      for (let i = 0; i < files.length; i++) {
        setUploadFileIndex(i)
        const form = new FormData()
        form.append("files", files[i])
        let stickerId: string | undefined
        await new Promise<void>((resolve, reject) => {
          const request = new XMLHttpRequest()
          request.open("POST", "/api/stickers")
          request.upload.onprogress = (event) => {
            if (!event.lengthComputable) return
            const fileProgress = event.loaded / event.total
            const overallPercent = Math.round(((i + fileProgress) / files.length) * 100)
            setUploadProgress(Math.min(overallPercent, 99))
          }
          request.onload = () => {
            const data = JSON.parse(request.responseText || "{}")
            if (request.status >= 200 && request.status < 300) {
              createdCount += data.items?.length ?? 0
              stickerId = data.items?.[0]?.id as string | undefined
              resolve()
            } else {
              reject(new Error(data.error ?? dict.common.error))
            }
          }
          request.onerror = () => reject(new Error(dict.common.error))
          request.send(form)
        })
        if (stickerId && uploadTargetGroup && userId) {
          try {
            await addStickersToGroup(uploadTargetGroup, [stickerId], userId)
          } catch { /* ignore group-add failures — don't block upload flow */ }
        }
        // refresh list after each success so the user sees it immediately
        if (cacheKey) removeUserStorage("local", cacheKey)
        await load()
      }
      setUploadProgress(100)
      toast.success(createdCount > 0 ? `${dict.common.upload} (${createdCount})` : `${dict.common.upload}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : dict.common.error)
    } finally {
      setUploading(false)
      setUploadFileTotal(0)
    }
  }

  async function handleContributeSelected() {
    if (!userId || selectedCustomIds.length === 0) return
    setSubmitting(true)
    try {
      const result = await contributeStickersToCommunity(selectedCustomIds, userId)
      toast.success(result.addedCount > 0 ? `${st.contributeToCommunity} (${result.addedCount})` : st.contributed)
      setCustomSelectionMode(false)
      setSelectedCustomIds([])
      if (cacheKey) removeUserStorage("local", cacheKey)
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : dict.common.error)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDeleteSelected() {
    if (!userId || selectedCustomIds.length === 0) return
    setSubmitting(true)
    try {
      const form = new FormData()
      form.set("action", "delete-custom")
      selectedCustomIds.forEach((id) => form.append("deleteStickerIds", id))
      const response = await fetch("/api/stickers", { method: "POST", body: form })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.error ?? dict.common.error)
      }
      toast.success(`${dict.common.delete} (${Number(data.deletedCount ?? 0)})`)
      setCustomSelectionMode(false)
      setSelectedCustomIds([])
      if (cacheKey) removeUserStorage("local", cacheKey)
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : dict.common.error)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleAddSelectedToMine() {
    if (!userId || selectedPublicIds.length === 0) return
    setSubmitting(true)
    try {
      const result = await saveStickersToCustomLibrary(selectedPublicIds, userId)
      toast.success(result.addedCount > 0 ? `${st.addToCustom} (${result.addedCount})` : st.savedToCustom)
      setPublicSelectionMode(false)
      setSelectedPublicIds([])
      if (cacheKey) removeUserStorage("local", cacheKey)
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : dict.common.error)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleAddSingleToMine(stickerId: string) {
    if (!userId) return
    try {
      const result = await saveStickerToCustomLibrary(stickerId, userId)
      toast.success(result.deduped ? st.savedToCustom : st.addToCustom)
      if (cacheKey) removeUserStorage("local", cacheKey)
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : dict.common.error)
    }
  }

  async function handleDeleteOwnPublic(stickerId: string) {
    if (!userId) return
    try {
      const form = new FormData()
      form.set("action", "delete-public")
      form.append("deleteStickerIds", stickerId)
      const res = await fetch("/api/stickers", { method: "POST", body: form })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? dict.common.error)
      toast.success(dict.common.delete)
      if (cacheKey) removeUserStorage("local", cacheKey)
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : dict.common.error)
    }
  }

  async function handleCreateGroup(scope: string) {
    if (!userId || !newGroupName.trim()) return
    try {
      await createStickerGroup(newGroupName.trim(), scope, userId)
      toast.success(st.createGroup)
      setCreatingGroup(false)
      setNewGroupName("")
      if (cacheKey) removeUserStorage("local", cacheKey)
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : dict.common.error)
    }
  }

  async function handleContributeGroupSelected() {
    if (!userId || groupSelectedIds.length === 0) return
    setSubmitting(true)
    try {
      const result = await contributeStickersToCommunity(groupSelectedIds, userId)
      toast.success(result.addedCount > 0 ? `${st.contributeToCommunity} (${result.addedCount})` : st.contributed)
      setGroupSelectionMode(null)
      setGroupSelectedIds([])
      if (cacheKey) removeUserStorage("local", cacheKey)
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : dict.common.error)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleRenameGroup(groupId: string) {
    if (!userId || !editGroupName.trim()) return
    try {
      await renameStickerGroup(groupId, editGroupName.trim(), userId)
      toast.success(st.renameGroup)
      setEditingGroupId(null)
      setEditGroupName("")
      if (cacheKey) removeUserStorage("local", cacheKey)
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : dict.common.error)
    }
  }

  async function handleDeleteGroup(groupId: string, groupName: string) {
    if (!userId || !window.confirm(`${dict.common.confirm} ${dict.common.delete} 「${groupName}」? ${dict.common.delete} ${st.defaultTab}`)) return
    try {
      await deleteStickerGroup(groupId, userId)
      toast.success(st.deleteGroup)
      if (cacheKey) removeUserStorage("local", cacheKey)
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : dict.common.error)
    }
  }

  async function handleAddStickersToGroup(groupId: string) {
    if (!userId || groupSelectedIds.length === 0) return
    try {
      const added = await addStickersToGroup(groupId, groupSelectedIds, userId)
      toast.success(added > 0 ? `${st.addToGroup} (${added})` : st.addToGroup)
      setGroupSelectionMode(null)
      setGroupSelectedIds([])
      if (cacheKey) removeUserStorage("local", cacheKey)
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : dict.common.error)
    }
  }

  async function handleRemoveStickersFromGroup(groupId: string) {
    if (!userId || groupSelectedIds.length === 0) return
    try {
      await removeStickersFromGroup(groupId, groupSelectedIds, userId)
      toast.success(st.removeFromGroup)
      setGroupSelectionMode(null)
      setGroupSelectedIds([])
      if (cacheKey) removeUserStorage("local", cacheKey)
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : dict.common.error)
    }
  }

  function toggleSelected(current: string[], stickerId: string) {
    return current.includes(stickerId)
      ? current.filter((id) => id !== stickerId)
      : [...current, stickerId]
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" className={compact ? "h-8 w-8 p-0" : "h-9 shrink-0"}>
          <SmilePlus size={14} />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[560px] p-0 max-md:w-[calc(100vw-1rem)]" align="start">
        <div className="flex items-center justify-between border-b border-[--color-border] px-3 py-2">
          <div className="flex gap-1">
            {[
              ["default", st.defaultTab],
              ["custom", st.customTab],
              ["public", st.publicTab],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setTab(key as typeof tab)
                  if (key !== "custom") {
                    setCustomSelectionMode(false)
                    setCustomSelectionAction("contribute")
                    setSelectedCustomIds([])
                    setGroupSelectionMode(null)
                    setGroupSelectedIds([])
                    setCreatingGroup(false)
                    setNewGroupName("")
                    setEditingGroupId(null)
                    setEditGroupName("")
                  }
                  if (key !== "public") {
                    setPublicSelectionMode(false)
                    setSelectedPublicIds([])
                  }
                }}
                className={`rounded px-2 py-1 text-sm ${tab === key ? "bg-[--color-bg-hover] text-[--color-text-primary]" : "text-[--color-text-muted]"}`}
              >
                {label}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => setOpen(false)} className="text-[--color-text-muted] hover:text-[--color-text-primary]">
            <X size={16} />
          </button>
        </div>

        {tab === "public" ? (
          <div className="flex items-center justify-between border-b border-[--color-border] px-3 py-2">
            <div className="flex items-center gap-2">
              {publicSelectionMode ? (
                <>
                  <Button type="button" size="sm" variant="outline" onClick={() => { setPublicSelectionMode(false); setSelectedPublicIds([]) }}>
                    {dict.common.cancel}
                  </Button>
                  <Button type="button" size="sm" onClick={() => void handleAddSelectedToMine()} disabled={submitting || selectedPublicIds.length === 0 || !userId}>
                    {dict.common.confirm}
                  </Button>
                </>
              ) : (
                <Button type="button" size="sm" variant="outline" onClick={() => setPublicSelectionMode(true)} disabled={!userId || publicStickers.length === 0}>
                  {st.addToCustom}
                </Button>
              )}
            </div>
            <Button asChild type="button" size="sm" variant="ghost">
              <Link href="/stickers/community" onClick={() => setOpen(false)}>
                {dict.common.show}
              </Link>
            </Button>
          </div>
        ) : null}

        <div className="max-h-[420px] overflow-y-auto overscroll-contain p-3" onWheel={(e) => e.stopPropagation()}>
          {tab === "default" ? (
            <div className="grid grid-cols-8 gap-1">
              {defaults.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => {
                    onPick({ type: "emoji", emoji })
                    setOpen(false)
                  }}
                  className="flex h-10 w-10 items-center justify-center rounded text-xl hover:bg-[--color-bg-hover]"
                >
                  {emoji}
                </button>
              ))}
            </div>
          ) : null}

          {tab === "custom" ? (
            <div className="space-y-4">
              {/* Group sections */}
              {customGroups.map((group) => {
                const isManaging = groupSelectionMode === group.id
                return (
                  <section key={group.id} className="rounded-2xl border border-[--color-border] bg-[--color-bg-surface] p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      {editingGroupId === group.id ? (
                        <div className="flex flex-1 items-center gap-1.5">
                          <input
                            type="text"
                            value={editGroupName}
                            onChange={(e) => setEditGroupName(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") void handleRenameGroup(group.id) }}
                            className="h-7 min-w-0 flex-1 rounded border border-[--color-border] bg-[--color-bg] px-2 text-sm"
                            autoFocus
                          />
                          <Button type="button" size="sm" className="h-7 px-2 text-xs" onClick={() => void handleRenameGroup(group.id)} disabled={!editGroupName.trim()}>{dict.common.ok}</Button>
                          <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => { setEditingGroupId(null); setEditGroupName("") }}>{dict.common.cancel}</Button>
                        </div>
                      ) : (
                        <span className="truncate text-sm font-medium text-[--color-text-primary]">{group.name}</span>
                      )}
                      {!editingGroupId && !customSelectionMode && groupSelectionMode === null ? (
                        <div className="flex shrink-0 gap-1">
                          <button type="button" className="rounded px-1.5 py-0.5 text-xs text-[--color-text-muted] hover:bg-[--color-bg-hover]" onClick={() => { setEditingGroupId(group.id); setEditGroupName(group.name) }}>{st.renameGroup}</button>
                          <button type="button" className="rounded px-1.5 py-0.5 text-xs text-[--color-danger] hover:bg-[--color-bg-hover]" onClick={() => void handleDeleteGroup(group.id, group.name)}>{dict.common.delete}</button>
                          <button type="button" className="rounded px-1.5 py-0.5 text-xs text-[--color-text-muted] hover:bg-[--color-bg-hover]" onClick={() => { setGroupSelectionMode(group.id); setGroupSelectedIds([]) }}>{st.manageGroups}</button>
                        </div>
                      ) : isManaging ? (
                        <div className="flex shrink-0 items-center gap-1">
                          <button type="button" className="rounded px-1.5 py-0.5 text-xs text-[--color-text-muted] hover:bg-[--color-bg-hover]" onClick={() => { setGroupSelectionMode(null); setGroupSelectedIds([]) }}>{dict.common.cancel}</button>
                          <button type="button" className="rounded px-1.5 py-0.5 text-xs text-[--color-danger] hover:bg-[--color-bg-hover]" disabled={groupSelectedIds.length === 0} onClick={() => void handleRemoveStickersFromGroup(group.id)}>{st.removeFromGroup}</button>
                          <button type="button" className="rounded px-1.5 py-0.5 text-xs text-[--color-text-muted] hover:bg-[--color-bg-hover]" disabled={groupSelectedIds.length === 0} onClick={() => void handleContributeGroupSelected()}>{st.contributeToCommunity}</button>
                          {customGroups.length > 1 ? (
                            <select
                              className="rounded border border-[--color-border] bg-[--color-bg] px-1 py-0.5 text-xs text-[--color-accent]"
                              value=""
                              disabled={groupSelectedIds.length === 0}
                              onChange={(e) => { if (e.target.value) { void handleAddStickersToGroup(e.target.value); e.target.value = "" } }}
                            >
                              <option value="" disabled>{st.addToGroup}...</option>
                              {customGroups.filter((g) => g.id !== group.id).map((g) => (
                                <option key={g.id} value={g.id}>{g.name}</option>
                              ))}
                            </select>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                    {group.stickers.length === 0 ? (
                      <p className="py-4 text-center text-xs text-[--color-text-muted]">{dict.common.noData}</p>
                    ) : (
                      <div className="grid grid-cols-5 gap-3">
                        {group.stickers.map((sticker) => (
                          <StickerTile
                            key={sticker.id}
                            sticker={sticker}
                            selectable={isManaging || customSelectionMode}
                            selected={isManaging ? groupSelectedIds.includes(sticker.id) : selectedCustomIds.includes(sticker.id)}
                            onClick={() => {
                              if (isManaging) {
                                setGroupSelectedIds((current) => toggleSelected(current, sticker.id))
                                return
                              }
                              if (customSelectionMode) {
                                setSelectedCustomIds((current) => toggleSelected(current, sticker.id))
                                return
                              }
                              onPick({ type: "asset", id: sticker.id, url: sticker.url, name: sticker.name || sticker.originalName, isAnimated: sticker.isAnimated })
                              setOpen(false)
                            }}
                          />
                        ))}
                      </div>
                    )}
                  </section>
                )
              })}

              {/* Ungrouped stickers */}
              {(custom.length > 0 || customGroups.length === 0) ? (
                <section className="rounded-2xl border border-[--color-border] bg-[--color-bg-surface] p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-[--color-text-muted]">{dict.common.none}</span>
                    {!customSelectionMode && groupSelectionMode === null && custom.length > 0 ? (
                      <button type="button" className="rounded px-1.5 py-0.5 text-xs text-[--color-text-muted] hover:bg-[--color-bg-hover]" onClick={() => { setGroupSelectionMode("ungrouped"); setGroupSelectedIds([]) }}>{st.manageGroups}</button>
                    ) : groupSelectionMode === "ungrouped" ? (
                      <div className="flex shrink-0 items-center gap-1">
                        <button type="button" className="rounded px-1.5 py-0.5 text-xs text-[--color-text-muted] hover:bg-[--color-bg-hover]" onClick={() => { setGroupSelectionMode(null); setGroupSelectedIds([]) }}>{dict.common.cancel}</button>
                        <button type="button" className="rounded px-1.5 py-0.5 text-xs text-[--color-text-muted] hover:bg-[--color-bg-hover]" disabled={groupSelectedIds.length === 0} onClick={() => void handleContributeGroupSelected()}>{st.contributeToCommunity}</button>
                        {customGroups.length > 0 ? (
                          <select
                            className="rounded border border-[--color-border] bg-[--color-bg] px-1 py-0.5 text-xs text-[--color-accent]"
                            value=""
                            disabled={groupSelectedIds.length === 0}
                            onChange={(e) => { if (e.target.value) { void handleAddStickersToGroup(e.target.value); e.target.value = "" } }}
                          >
                            <option value="" disabled>{st.addToGroup}...</option>
                            {customGroups.map((g) => (
                              <option key={g.id} value={g.id}>{g.name}</option>
                            ))}
                          </select>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                  {custom.length === 0 ? (
                    <p className="py-4 text-center text-xs text-[--color-text-muted]">{dict.common.noData}</p>
                  ) : (
                    <div className="grid grid-cols-5 gap-3">
                      {custom.map((sticker) => (
                        <StickerTile
                          key={sticker.id}
                          sticker={sticker}
                          selectable={customSelectionMode || groupSelectionMode === "ungrouped"}
                          selected={customSelectionMode ? selectedCustomIds.includes(sticker.id) : groupSelectionMode === "ungrouped" ? groupSelectedIds.includes(sticker.id) : false}
                          onClick={() => {
                            if (customSelectionMode) {
                              setSelectedCustomIds((current) => toggleSelected(current, sticker.id))
                              return
                            }
                            if (groupSelectionMode === "ungrouped") {
                              setGroupSelectedIds((current) => toggleSelected(current, sticker.id))
                              return
                            }
                            onPick({ type: "asset", id: sticker.id, url: sticker.url, name: sticker.name || sticker.originalName, isAnimated: sticker.isAnimated })
                            setOpen(false)
                          }}
                        />
                      ))}
                    </div>
                  )}
                </section>
              ) : null}

              {/* Create group */}
              {!customSelectionMode && groupSelectionMode === null && !editingGroupId ? (
                creatingGroup ? (
                  <div className="flex items-center gap-1.5 rounded-2xl border border-[--color-border] bg-[--color-bg-surface] p-3">
                    <input
                      type="text"
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") void handleCreateGroup("custom") }}
                      placeholder={st.groupName}
                      className="h-7 min-w-0 flex-1 rounded border border-[--color-border] bg-[--color-bg] px-2 text-sm"
                      autoFocus
                      maxLength={20}
                    />
                    <Button type="button" size="sm" className="h-7 px-2 text-xs" onClick={() => void handleCreateGroup("custom")} disabled={!newGroupName.trim()}>{dict.common.ok}</Button>
                    <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => { setCreatingGroup(false); setNewGroupName("") }}>{dict.common.cancel}</Button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="flex w-full items-center justify-center gap-1 rounded-2xl border border-dashed border-[--color-border] bg-[--color-bg-surface] p-3 text-sm text-[--color-text-muted] hover:border-[--color-accent] hover:text-[--color-accent]"
                    onClick={() => setCreatingGroup(true)}
                  >
                    + {st.createGroup}
                  </button>
                )
              ) : null}
            </div>
          ) : null}

          {tab === "public" ? (
            <div className="space-y-4">
              {/* Contributor sections */}
              {groupedPublic.map((group) => (
                <section key={group.contributor.id} className="space-y-2 rounded-2xl border border-[--color-border] bg-[--color-bg-surface] p-3">
                  <div className="flex items-center gap-3">
                    <UserAvatar
                      size="sm"
                      name={group.contributor.displayName}
                      email={group.contributor.email}
                      avatarText={group.contributor.avatarText}
                      avatarUrl={group.contributor.avatarUrl}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[--color-text-primary]">{group.contributor.displayName || group.contributor.email}</p>
                      <p className="truncate text-xs text-[--color-text-muted]">{st.communityStickers}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-5 gap-3">
                    {group.stickers.map((sticker) => (
                      <StickerTile
                        key={sticker.id}
                        sticker={sticker}
                        selectable={publicSelectionMode}
                        selected={selectedPublicIds.includes(sticker.id)}
                        contextItems={(() => {
                          const items: MessageActionItem[] = []
                          if (userId) {
                            items.push({
                              id: "save-to-custom",
                              label: st.addToCustom,
                              onSelect: () => { void handleAddSingleToMine(sticker.id) },
                            })
                          }
                          if (userId && group.contributor.id === userId) {
                            items.push({
                              id: "delete-public",
                              label: dict.common.delete,
                              onSelect: () => { void handleDeleteOwnPublic(sticker.id) },
                            })
                          }
                          return items
                        })()}
                        onClick={() => {
                          if (publicSelectionMode) {
                            setSelectedPublicIds((current) => toggleSelected(current, sticker.id))
                            return
                          }
                          onPick({ type: "asset", id: sticker.id, url: sticker.url, name: sticker.name || sticker.originalName, isAnimated: sticker.isAnimated })
                          setOpen(false)
                        }}
                      />
                    ))}
                  </div>
                </section>
              ))}
              {groupedPublic.length === 0 ? (
                <p className="py-10 text-center text-sm text-[--color-text-muted]">{dict.common.noData}</p>
              ) : null}
            </div>
          ) : null}
        </div>

        {tab === "custom" ? (
          <div className="border-t border-[--color-border] p-3">
            {customSelectionMode ? (
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="outline" className="flex-1" onClick={() => { setCustomSelectionMode(false); setSelectedCustomIds([]) }}>
                  {dict.common.cancel}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="flex-1"
                  disabled={submitting || selectedCustomIds.length === 0 || !userId}
                  onClick={() => void (customSelectionAction === "delete" ? handleDeleteSelected() : handleContributeSelected())}
                >
                  {customSelectionAction === "delete" ? dict.common.delete : st.contributeToCommunity}
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {uploading ? (
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <Loader2 size={14} className="animate-spin text-[--color-accent]" />
                      <span className="text-sm text-[--color-text-primary]">{dict.common.uploading}</span>
                      <span className="text-xs tabular-nums text-[--color-text-muted]">
                        {uploadFileTotal > 1 ? `(${Math.min(uploadFileIndex + 1, uploadFileTotal)}/${uploadFileTotal})` : `(${uploadProgress}%)`}
                      </span>
                    </div>
                    <div className="overflow-hidden rounded-full" style={{ height: 6, backgroundColor: "var(--color-border, #e5e7eb)" }}>
                      <div className="h-full rounded-full transition-all duration-200" style={{ width: `${uploadProgress}%`, backgroundColor: "var(--color-accent, #2563eb)" }} />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      {customGroups.length > 0 ? (
                        <select
                          className="h-9 rounded border border-[--color-border] bg-[--color-bg] px-2 text-xs text-[--color-text-primary]"
                          value={uploadTargetGroup}
                          onChange={(e) => setUploadTargetGroup(e.target.value)}
                        >
                          <option value="">{dict.common.none}</option>
                          {customGroups.map((g) => (
                            <option key={g.id} value={g.id}>{dict.common.upload} {g.name}</option>
                          ))}
                        </select>
                      ) : null}
                      <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={upload} />
                      <Button type="button" size="sm" variant="outline" className="flex-1 gap-1.5" onClick={() => inputRef.current?.click()}>
                        <Upload size={14} />
                        {dict.common.upload}
                      </Button>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="flex-1 gap-1.5"
                        disabled={!userId || (custom.length === 0 && customGroups.every((g) => g.stickers.length === 0))}
                        onClick={() => {
                          setCustomSelectionAction("contribute")
                          setCustomSelectionMode(true)
                        }}
                      >
                        <Plus size={14} />
                        {st.contributeToCommunity}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="flex-1 gap-1.5"
                        disabled={!userId || (custom.length === 0 && customGroups.every((g) => g.stickers.length === 0))}
                        onClick={() => {
                          setCustomSelectionAction("delete")
                          setCustomSelectionMode(true)
                        }}
                      >
                        {dict.common.delete}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  )
}
