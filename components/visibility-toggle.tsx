"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { getDict } from "@/lib/i18n"

export function VisibilityToggle({
  postId,
  initialVisibility,
}: {
  postId: string
  initialVisibility: string
}) {
  const dict = getDict()
  const ar = dict.article
  const router = useRouter()
  const [visibility, setVisibility] = useState(initialVisibility)
  const [saving, setSaving] = useState(false)

  async function updateVisibility(nextVisibility: string) {
    if (nextVisibility === visibility || saving) return
    setSaving(true)

    const previous = visibility
    setVisibility(nextVisibility)

    const res = await fetch(`/api/posts/${postId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visibility: nextVisibility }),
      cache: "no-store",
    }).catch(() => null)

    if (!res?.ok) {
      setVisibility(previous)
      toast.error(ar.visibilityUpdated)
    } else {
      toast.success(
        nextVisibility === "private" ? ar.visibilityPrivate : nextVisibility === "friends" ? ar.visibilityFriends : dict.common.ok
      )
      router.refresh()
    }

    setSaving(false)
  }

  const OPTIONS = [
    { value: "private", label: ar.visibilityPrivate },
    { value: "friends", label: ar.visibilityFriends },
  ] as const

  return (
    <select
      value={visibility === "friends" ? "friends" : "private"}
      disabled={saving}
      onChange={(event) => updateVisibility(event.target.value)}
      className="h-10 rounded-md border border-input bg-background px-3 !text-sm font-medium text-[--color-text-primary] outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
      aria-label={ar.visibilityLabel}
    >
      {OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>{option.label}</option>
      ))}
    </select>
  )
}
