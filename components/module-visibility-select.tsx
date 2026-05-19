"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { getDict } from "@/lib/i18n"
import type { ModuleKey } from "@/lib/permissions"
import { isVisibility, type Visibility } from "@/lib/visibility"

export function ModuleVisibilitySelect({
  module,
  initialVisibility,
  labels,
}: {
  module: ModuleKey
  initialVisibility: Visibility
  labels?: {
    private: string
    friends: string
    public: string
    saveFailed: string
    savedPrivate: string
    savedFriends: string
    savedPublic: string
  }
}) {
  const dict = getDict()
  const router = useRouter()
  const [visibility, setVisibility] = useState(initialVisibility)
  const [saving, setSaving] = useState(false)

  const text = labels ?? {
    private: dict.settings.privateVisibility,
    friends: dict.settings.friendsVisibility,
    public: dict.settings.publicVisibility,
    saveFailed: "Failed to update visibility",
    savedPrivate: "Module set to private",
    savedFriends: "Friends can now view this module",
    savedPublic: "Anyone with the link can now view this module",
  }

  async function handleChange(nextVisibility: string) {
    if (!isVisibility(nextVisibility)) return
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
      toast.error(text.saveFailed)
    } else {
      toast.success(
        nextVisibility === "public"
          ? text.savedPublic
          : nextVisibility === "friends"
            ? text.savedFriends
            : text.savedPrivate
      )
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
      aria-label="Module visibility"
    >
      <option value="private">{text.private}</option>
      <option value="friends">{text.friends}</option>
      <option value="public">{text.public}</option>
    </select>
  )
}
