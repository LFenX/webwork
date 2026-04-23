"use client"

import { ChangeEvent, useCallback, useEffect, useRef, useState } from "react"
import { SmilePlus, Upload, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { readUserStorage, removeUserStorage, userStorageKey, writeUserStorage } from "@/lib/client-storage"

export type StickerPick =
  | { type: "emoji"; emoji: string }
  | { type: "asset"; id: string; url: string; name: string; isAnimated: boolean }

type StickerAsset = {
  id: string
  name: string
  originalName: string
  mimeType: string
  size: number
  isAnimated: boolean
  url: string
}

const STICKER_CACHE_TTL_MS = 24 * 60 * 60 * 1000

type StickerCache = {
  defaults: string[]
  custom: StickerAsset[]
  public: StickerAsset[]
}

export function StickerPicker({ onPick, compact = false, userId }: { onPick: (pick: StickerPick) => void; compact?: boolean; userId?: string }) {
  const [open, setOpen] = useState(false)
  const [defaults, setDefaults] = useState<string[]>([])
  const [custom, setCustom] = useState<StickerAsset[]>([])
  const [publicStickers, setPublicStickers] = useState<StickerAsset[]>([])
  const [tab, setTab] = useState<"default" | "custom" | "public">("default")
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const cacheKey = userId ? userStorageKey(userId, "stickers-cache", "picker") : ""

  const load = useCallback(async () => {
    if (cacheKey && userId) {
      const cached = readUserStorage<StickerCache>({ kind: "local", key: cacheKey, userId, ttlMs: STICKER_CACHE_TTL_MS })
      if (cached) {
        setDefaults(cached.defaults)
        setCustom(cached.custom)
        setPublicStickers(cached.public)
      }
    }
    const res = await fetch("/api/stickers", { cache: "no-store" })
    if (!res.ok) return
    const data = await res.json()
    const next = {
      defaults: Array.isArray(data.defaults) ? data.defaults : [],
      custom: Array.isArray(data.custom) ? data.custom : [],
      public: Array.isArray(data.public) ? data.public : [],
    }
    setDefaults(next.defaults)
    setCustom(next.custom)
    setPublicStickers(next.public)
    if (cacheKey && userId) writeUserStorage({ kind: "local", key: cacheKey, userId, value: next })
  }, [cacheKey, userId])

  useEffect(() => {
    if (!open) return
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [load, open])

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])
    event.currentTarget.value = ""
    if (files.length === 0) return
    setUploading(true)
    try {
      const form = new FormData()
      files.forEach((file) => form.append("files", file))
      const res = await fetch("/api/stickers", { method: "POST", body: form })
      if (res.ok) {
        if (cacheKey) removeUserStorage("local", cacheKey)
        await load()
      }
    } finally {
      setUploading(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" className={compact ? "h-8 w-8 p-0" : "h-9 shrink-0"}>
          <SmilePlus size={14} />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[340px] p-0" align="start">
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
                onClick={() => setTab(key as typeof tab)}
                className={`rounded px-2 py-1 text-xs ${tab === key ? "bg-[--color-bg-hover] text-[--color-text-primary]" : "text-[--color-text-muted]"}`}
              >
                {label}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => setOpen(false)} className="text-[--color-text-muted] hover:text-[--color-text-primary]">
            <X size={14} />
          </button>
        </div>
        <div className="max-h-72 overflow-y-auto p-3">
          {tab === "default" && (
            <div className="grid grid-cols-8 gap-1">
              {defaults.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => {
                    onPick({ type: "emoji", emoji })
                    setOpen(false)
                  }}
                  className="flex h-9 w-9 items-center justify-center rounded text-xl hover:bg-[--color-bg-hover]"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
          {tab !== "default" && (
            <div className="grid grid-cols-5 gap-2">
              {(tab === "custom" ? custom : publicStickers).map((sticker) => (
                <button
                  key={sticker.id}
                  type="button"
                  onClick={() => {
                    onPick({ type: "asset", id: sticker.id, url: sticker.url, name: sticker.name || sticker.originalName, isAnimated: sticker.isAnimated })
                    setOpen(false)
                  }}
                  className="flex aspect-square items-center justify-center overflow-hidden rounded border border-[--color-border] bg-white hover:border-[--color-accent]"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={sticker.url} alt={sticker.name || sticker.originalName} className="max-h-full max-w-full object-contain" />
                </button>
              ))}
              {tab === "custom" && custom.length === 0 && (
                <p className="col-span-5 py-6 text-center text-xs text-[--color-text-muted]">还没有自定义表情包</p>
              )}
              {tab === "public" && publicStickers.length === 0 && (
                <p className="col-span-5 py-6 text-center text-xs text-[--color-text-muted]">公用表情包库暂无内容</p>
              )}
            </div>
          )}
        </div>
        {tab === "custom" && (
          <div className="border-t border-[--color-border] p-3">
            <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={upload} />
            <Button type="button" size="sm" variant="outline" className="w-full gap-1.5" disabled={uploading} onClick={() => inputRef.current?.click()}>
              <Upload size={14} />
              {uploading ? "上传中..." : "批量上传表情包"}
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
