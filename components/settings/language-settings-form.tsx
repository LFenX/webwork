"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Globe2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { SettingsSection } from "@/components/settings/settings-shell"
import { cn } from "@/lib/utils"
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

  const options: { value: AppLocale; label: string; sub: string }[] = [
    { value: "zh-CN", label: labels.chinese, sub: "简体中文" },
    { value: "en-US", label: labels.english, sub: "English (US)" },
  ]

  return (
    <SettingsSection
      icon={<Globe2 size={16} />}
      title={labels.language}
      description={labels.languageHint}
      footer={
        <Button type="button" onClick={handleSave} loading={saving} loadingText={labels.saving}>
          {labels.save}
        </Button>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {options.map((opt) => {
          const active = language === opt.value
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => setLanguage(opt.value)}
              aria-pressed={active}
              className={cn(
                "flex items-center justify-between gap-4 rounded-[--radius-lg] border bg-[--color-bg-surface] px-4 py-3 text-left transition-all",
                active
                  ? "border-[--color-brand] shadow-[0_0_0_3px_var(--color-brand-soft)]"
                  : "border-[--color-border] hover:border-[--color-brand-border] hover:bg-[--color-bg-hover]",
              )}
            >
              <div>
                <div className="text-[14px] font-medium text-[--color-text-primary]">{opt.label}</div>
                <div className="mt-0.5 text-[12px] text-[--color-text-muted]">{opt.sub}</div>
              </div>
              <span
                aria-hidden
                className={cn(
                  "inline-flex h-5 w-5 items-center justify-center rounded-full border transition-colors",
                  active ? "border-[--color-brand] bg-[--color-brand]" : "border-[--color-border-strong] bg-transparent",
                )}
              >
                {active ? <span className="h-1.5 w-1.5 rounded-full bg-white" /> : null}
              </span>
            </button>
          )
        })}
      </div>
    </SettingsSection>
  )
}
