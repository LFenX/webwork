"use client"

import Link from "next/link"
import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Check, Plus, SmilePlus, Upload, X } from "lucide-react"
import { toast } from "sonner"
import { MessageActionSurface, type MessageActionItem } from "@/components/chat-message-actions"
import { UserAvatar } from "@/components/user-avatar"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  contributeStickersToCommunity,
  saveStickerToCustomLibrary,
  saveStickersToCustomLibrary,
} from "@/lib/chat-media-actions"
import { readUserStorage, removeUserStorage, userStorageKey, writeUserStorage } from "@/lib/client-storage"

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

type StickerCache = {
  defaults: string[]
  custom: StickerAsset[]
  public: StickerAsset[]
  publicGroups: PublicStickerGroup[]
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
  const [open, setOpen] = useState(false)
  const [defaults, setDefaults] = useState<string[]>([])
  const [custom, setCustom] = useState<StickerAsset[]>([])
  const [publicStickers, setPublicStickers] = useState<StickerAsset[]>([])
  const [publicGroups, setPublicGroups] = useState<PublicStickerGroup[]>([])
  const [tab, setTab] = useState<"default" | "custom" | "public">("default")
  const [uploading, setUploading] = useState(false)
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
    }
    setDefaults(next.defaults)
    setCustom(next.custom)
    setPublicStickers(next.public)
    setPublicGroups(next.publicGroups)
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

  const groupedPublic = useMemo(() => {
    if (publicGroups.length > 0) return publicGroups
    return publicStickers.length > 0
      ? [{
          contributor: {
            id: "community",
            email: "",
            displayName: "社区表情",
            avatarText: "社区",
            avatarUrl: null,
          },
          stickers: publicStickers,
        }]
      : []
  }, [publicGroups, publicStickers])

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.currentTarget.value = ""
    if (!file) return
    setUploading(true)
    try {
      const form = new FormData()
      form.append("files", file)
      const res = await fetch("/api/stickers", { method: "POST", body: form })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error ?? "上传表情失败")
        return
      }
      if (cacheKey) removeUserStorage("local", cacheKey)
      await load()
      toast.success("表情已上传")
    } finally {
      setUploading(false)
    }
  }

  async function handleContributeSelected() {
    if (!userId || selectedCustomIds.length === 0) return
    setSubmitting(true)
    try {
      const result = await contributeStickersToCommunity(selectedCustomIds, userId)
      toast.success(result.addedCount > 0 ? `已贡献 ${result.addedCount} 个表情到社区` : "选中的表情已存在于社区")
      setCustomSelectionMode(false)
      setSelectedCustomIds([])
      if (cacheKey) removeUserStorage("local", cacheKey)
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "贡献表情失败")
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
        throw new Error(data.error ?? "删除表情失败")
      }
      toast.success(`已删除 ${Number(data.deletedCount ?? 0)} 个表情`)
      setCustomSelectionMode(false)
      setSelectedCustomIds([])
      if (cacheKey) removeUserStorage("local", cacheKey)
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "删除表情失败")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleAddSelectedToMine() {
    if (!userId || selectedPublicIds.length === 0) return
    setSubmitting(true)
    try {
      const result = await saveStickersToCustomLibrary(selectedPublicIds, userId)
      toast.success(result.addedCount > 0 ? `已添加 ${result.addedCount} 个表情到我的表情` : "选中的表情都已在我的表情中")
      setPublicSelectionMode(false)
      setSelectedPublicIds([])
      if (cacheKey) removeUserStorage("local", cacheKey)
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "添加表情失败")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleAddSingleToMine(stickerId: string) {
    if (!userId) return
    try {
      const result = await saveStickerToCustomLibrary(stickerId, userId)
      toast.success(result.deduped ? "该表情已在我的表情中" : "已添加到我的表情")
      if (cacheKey) removeUserStorage("local", cacheKey)
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "添加表情失败")
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
              ["default", "默认"],
              ["custom", "我的"],
              ["public", "公用"],
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
                    取消
                  </Button>
                  <Button type="button" size="sm" onClick={() => void handleAddSelectedToMine()} disabled={submitting || selectedPublicIds.length === 0 || !userId}>
                    确定添加
                  </Button>
                </>
              ) : (
                <Button type="button" size="sm" variant="outline" onClick={() => setPublicSelectionMode(true)} disabled={!userId || publicStickers.length === 0}>
                  批量添加到我的表情
                </Button>
              )}
            </div>
            <Button asChild type="button" size="sm" variant="ghost">
              <Link href="/stickers/community" onClick={() => setOpen(false)}>
                查看详情
              </Link>
            </Button>
          </div>
        ) : null}

        <div className="max-h-[420px] overflow-y-auto p-3">
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
            <>
              {custom.length === 0 ? (
                <p className="py-10 text-center text-sm text-[--color-text-muted]">还没有自定义表情包</p>
              ) : (
                <div className="grid grid-cols-5 gap-3">
                  {custom.map((sticker) => (
                    <StickerTile
                      key={sticker.id}
                      sticker={sticker}
                      selectable={customSelectionMode}
                      selected={selectedCustomIds.includes(sticker.id)}
                      onClick={() => {
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
            </>
          ) : null}

          {tab === "public" ? (
            groupedPublic.length === 0 ? (
              <p className="py-10 text-center text-sm text-[--color-text-muted]">公用表情包库暂无内容</p>
            ) : (
              <div className="space-y-4">
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
                        <p className="truncate text-xs text-[--color-text-muted]">贡献的表情包</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-5 gap-3">
                      {group.stickers.map((sticker) => (
                        <StickerTile
                          key={sticker.id}
                          sticker={sticker}
                          selectable={publicSelectionMode}
                          selected={selectedPublicIds.includes(sticker.id)}
                          contextItems={userId ? [{
                            id: "save-to-custom",
                            label: "添加到我的表情",
                            onSelect: () => {
                              void handleAddSingleToMine(sticker.id)
                            },
                          }] : []}
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
              </div>
            )
          ) : null}
        </div>

        {tab === "custom" ? (
          <div className="border-t border-[--color-border] p-3">
            {customSelectionMode ? (
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="outline" className="flex-1" onClick={() => { setCustomSelectionMode(false); setSelectedCustomIds([]) }}>
                  取消
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="flex-1"
                  disabled={submitting || selectedCustomIds.length === 0 || !userId}
                  onClick={() => void (customSelectionAction === "delete" ? handleDeleteSelected() : handleContributeSelected())}
                >
                  {customSelectionAction === "delete" ? "确定删除" : "确定贡献"}
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={upload} />
                <Button type="button" size="sm" variant="outline" className="flex-1 gap-1.5" disabled={uploading} onClick={() => inputRef.current?.click()}>
                  <Upload size={14} />
                  {uploading ? "上传中..." : "上传表情包"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="flex-1 gap-1.5"
                  disabled={!userId || custom.length === 0}
                  onClick={() => {
                    setCustomSelectionAction("contribute")
                    setCustomSelectionMode(true)
                  }}
                >
                  <Plus size={14} />
                  贡献表情包到社区
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="flex-1 gap-1.5"
                  disabled={!userId || custom.length === 0}
                  onClick={() => {
                    setCustomSelectionAction("delete")
                    setCustomSelectionMode(true)
                  }}
                >
                  删除表情包
                </Button>
              </div>
            )}
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  )
}
