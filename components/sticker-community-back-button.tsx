"use client"

import { useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { getDict } from "@/lib/i18n"

export function StickerCommunityBackButton() {
  const router = useRouter()
  const dict = getDict()

  return (
    <button
      type="button"
      onClick={() => {
        if (window.history.length > 1) {
          router.back()
          return
        }
        router.push("/channels")
      }}
      className="inline-flex items-center gap-2 rounded-full border border-[--color-border] bg-[--color-bg-surface] px-3 py-2 text-sm text-[--color-text-secondary] transition-colors hover:text-[--color-text-primary]"
    >
      <ArrowLeft size={16} />
      {dict.stickers.back}
    </button>
  )
}
