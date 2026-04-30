"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { AppLocale } from "@/lib/i18n"

export function LanguageSettingsForm({
  initialLanguage,
  labels,
}: {
  initialLanguage: AppLocale
  labels: {
    language: string
    languageHint: string
    chinese: string
    english: string
    save: string
    saving: string
    saved: string
  }
}) {
  const router = useRouter()
  const [language, setLanguage] = useState<AppLocale>(initialLanguage)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error ?? labels.saved)
      toast.success(labels.saved)
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : labels.saved)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface] p-5">
      <div className="max-w-lg">
        <Label className="mb-2 block">{labels.language}</Label>
        <Select value={language} onValueChange={(value) => setLanguage(value as AppLocale)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="zh-CN">{labels.chinese}</SelectItem>
            <SelectItem value="en-US">{labels.english}</SelectItem>
          </SelectContent>
        </Select>
        <p className="mt-3 text-sm text-[--color-text-secondary]">{labels.languageHint}</p>
      </div>
      <div className="mt-6 flex justify-end">
        <Button type="button" onClick={handleSave} loading={saving} loadingText={labels.saving}>
          {labels.save}
        </Button>
      </div>
    </section>
  )
}
