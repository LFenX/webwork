"use client"

import { useState } from "react"
import { Share2 } from "lucide-react"
import { toast } from "sonner"
import { copyTextWithToast } from "@/lib/interaction-feedback"

export function ArticleShareButton({
  publicHref,
  canShare,
  labels,
}: {
  publicHref: string
  canShare: boolean
  labels: {
    share: string
    copied: string
    copyFailed: string
    needsPublic: string
  }
}) {
  const [copying, setCopying] = useState(false)

  async function handleShare() {
    if (!canShare) {
      toast.info(labels.needsPublic)
      return
    }
    if (copying) return

    setCopying(true)
    try {
      const url = new URL(publicHref, window.location.origin).toString()
      await copyTextWithToast(url, labels.copied, labels.copyFailed)
    } finally {
      setCopying(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleShare}
      disabled={copying}
      className="notion-toolbar-button size-8 shrink-0 justify-center p-0 disabled:cursor-not-allowed disabled:opacity-60"
      title={labels.share}
      aria-label={labels.share}
    >
      <Share2 size={14} />
    </button>
  )
}
