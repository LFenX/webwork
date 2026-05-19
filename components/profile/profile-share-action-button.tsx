"use client"

import { useState } from "react"
import { Share2 } from "lucide-react"
import { copyTextWithToast } from "@/lib/interaction-feedback"
import { cn } from "@/lib/utils"

type ActionVariant = "primary" | "secondary" | "ghost"

export function ProfileShareActionButton({
  href,
  label,
  large = false,
  variant = "secondary",
  copiedLabel = "公开主页链接已复制",
  copyFailedLabel = "复制失败，请手动复制",
}: {
  href: string
  label: string
  large?: boolean
  variant?: ActionVariant
  copiedLabel?: string
  copyFailedLabel?: string
}) {
  const [copying, setCopying] = useState(false)

  async function handleCopy() {
    if (copying) return
    setCopying(true)
    try {
      const url = new URL(href, window.location.origin).toString()
      await copyTextWithToast(url, copiedLabel, copyFailedLabel)
    } finally {
      setCopying(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      disabled={copying}
      className={cn(
        "inline-flex w-full min-w-0 items-center justify-center gap-2 rounded-[12px] text-sm font-semibold transition-all hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60",
        large ? "min-h-12 px-5" : "min-h-10 px-4",
        variant === "primary" && "bg-blue-600 !text-white shadow-[0_12px_24px_rgba(37,99,235,0.24)] hover:bg-blue-700 hover:!text-white",
        variant === "secondary" && "border border-blue-200 bg-white text-blue-600 shadow-sm hover:border-blue-300 hover:bg-blue-50",
        variant === "ghost" && "border border-slate-200 bg-white text-slate-700 shadow-sm hover:border-slate-300 hover:bg-slate-50"
      )}
      title={label}
      aria-label={label}
    >
      <Share2 size={large ? 19 : 16} className="shrink-0" />
      <span className="truncate">{label}</span>
    </button>
  )
}
