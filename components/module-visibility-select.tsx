"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import type { ModuleKey } from "@/lib/permissions"

export function ModuleVisibilitySelect({
  module,
  initialVisibility,
}: {
  module: ModuleKey
  initialVisibility: "private" | "friends"
}) {
  const router = useRouter()
  const [visibility, setVisibility] = useState(initialVisibility)
  const [saving, setSaving] = useState(false)

  async function handleChange(nextVisibility: string) {
    if (nextVisibility !== "private" && nextVisibility !== "friends") return
    if (nextVisibility === visibility || saving) return

    const previous = visibility
    setVisibility(nextVisibility)
    setSaving(true)

    const res = await fetch("/api/module-visibility", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ module, visibility: nextVisibility }),
      cache: "no-store",
    }).catch(() => null)

    if (!res?.ok) {
      setVisibility(previous)
      toast.error("模块权限更新失败")
    } else {
      toast.success(nextVisibility === "friends" ? "好友现在可见该模块" : "该模块已设为私密")
      router.refresh()
    }

    setSaving(false)
  }

  return (
    <select
      value={visibility}
      disabled={saving}
      onChange={(event) => handleChange(event.target.value)}
      className="h-8 rounded-[--radius-sm] border border-[--color-border-strong] bg-[--color-bg-surface] px-2.5 text-sm text-[--color-text-primary] outline-none hover:bg-[--color-bg-hover] focus:border-[--color-text-primary]"
      aria-label="模块可见性"
    >
      <option value="private">私密</option>
      <option value="friends">好友可见</option>
    </select>
  )
}
