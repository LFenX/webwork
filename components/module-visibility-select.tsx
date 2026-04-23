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
      className="h-10 rounded-md border border-input bg-background px-3 !text-sm font-medium text-[--color-text-primary] outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
      aria-label="模块可见性"
    >
      <option value="private">私密</option>
      <option value="friends">好友可见</option>
    </select>
  )
}
