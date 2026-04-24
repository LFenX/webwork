"use client"

import { useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"

export function StickerCommunityBackButton() {
  const router = useRouter()

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
      返回
    </button>
  )
}
