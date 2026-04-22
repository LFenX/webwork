"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

const OPTIONS = [
  { value: "private", label: "私密" },
  { value: "friends", label: "好友可见" },
] as const

export function VisibilityToggle({
  postId,
  initialVisibility,
}: {
  postId: string
  initialVisibility: string
}) {
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
      toast.error("权限更新失败")
    } else {
      toast.success(nextVisibility === "private" ? "已设为私密" : nextVisibility === "friends" ? "好友现在可见" : "已公开")
      router.refresh()
    }

    setSaving(false)
  }

  return (
    <select
      value={visibility === "friends" ? "friends" : "private"}
      disabled={saving}
      onChange={(event) => updateVisibility(event.target.value)}
      className="h-8 rounded-[--radius-sm] border border-[--color-border-strong] bg-[--color-bg-surface] px-2.5 text-sm text-[--color-text-primary] outline-none hover:bg-[--color-bg-hover] focus:border-[--color-text-primary]"
      aria-label="文章可见性"
    >
      {OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>{option.label}</option>
      ))}
    </select>
  )
}
