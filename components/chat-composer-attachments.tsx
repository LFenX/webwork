"use client"

import { useEffect, useMemo } from "react"
import { File as FileIcon, X } from "lucide-react"
import type { StickerPick } from "@/components/sticker-picker"

function formatBytes(size: number) {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

function fileKindLabel(file: Pick<File, "name" | "type">, fileLabel: string) {
  const ext = file.name.split(".").pop()?.toUpperCase()
  return ext || fileLabel
}

function ComposerFileChip({
  file,
  fileLabel,
  onRemove,
}: {
  file: File
  fileLabel: string
  onRemove: () => void
}) {
  const previewUrl = useMemo(() => (file.type.startsWith("image/") ? URL.createObjectURL(file) : null), [file])

  useEffect(() => {
    if (!previewUrl) return
    return () => URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  const isImage = Boolean(previewUrl)

  if (isImage && previewUrl) {
    return (
      <div className="group relative flex h-[104px] w-[104px] shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-black/8 bg-[#eef2ff] shadow-[0_1px_2px_rgba(15,23,42,0.06)]">
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt={file.name} className="h-full w-full object-cover" />
        ) : null}
        <button
          type="button"
          onClick={onRemove}
          className="absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-black text-white shadow-sm transition-transform hover:scale-105"
          aria-label="Remove attachment"
        >
          <X size={14} />
        </button>
      </div>
    )
  }

  return (
    <div className="group relative flex min-w-[150px] max-w-[220px] items-center gap-3 overflow-hidden rounded-2xl border border-black/8 bg-white px-3 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.06)]">
      <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[#fff1f2]">
        <FileIcon size={26} className="text-[#ff4d4f]" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-semibold text-[--color-text-primary]">{file.name || "file"}</p>
        <p className="truncate text-sm text-[--color-text-muted]">
          {fileKindLabel(file, fileLabel)} / {formatBytes(file.size)}
        </p>
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-black text-white shadow-sm transition-transform hover:scale-105"
        aria-label="Remove attachment"
      >
        <X size={14} />
      </button>
    </div>
  )
}

function ComposerStickerChip({
  sticker,
  onRemove,
}: {
  sticker: StickerPick
  onRemove: () => void
}) {
  return (
    <div className="group relative flex h-[104px] w-[104px] shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-black/8 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.06)]">
      {sticker.type === "emoji" ? (
        <span className="text-4xl leading-none">{sticker.emoji}</span>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={sticker.url} alt={sticker.name} className="h-full w-full object-cover" />
      )}
      <button
        type="button"
        onClick={onRemove}
        className="absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-black text-white shadow-sm transition-transform hover:scale-105"
        aria-label="Remove sticker"
      >
        <X size={14} />
      </button>
    </div>
  )
}

export function ChatComposerAttachments({
  files,
  sticker,
  fileLabel,
  onRemoveFile,
  onRemoveSticker,
}: {
  files: File[]
  sticker?: StickerPick | null
  fileLabel: string
  onRemoveFile: (index: number) => void
  onRemoveSticker: () => void
}) {
  const hasItems = files.length > 0 || Boolean(sticker)

  if (!hasItems) return null

  return (
    <div className="border-b border-black/6 px-3 pb-3 pt-2">
      <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {files.map((file, index) => (
          <ComposerFileChip
            key={`${file.name}-${file.lastModified}-${index}`}
            file={file}
            fileLabel={fileLabel}
            onRemove={() => onRemoveFile(index)}
          />
        ))}
        {sticker ? (
          <ComposerStickerChip sticker={sticker} onRemove={onRemoveSticker} />
        ) : null}
      </div>
    </div>
  )
}
