"use client"

import { type ChangeEvent, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Copy, IdCard, Upload, UserCircle } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { SettingsSection } from "@/components/settings/settings-shell"
import { copyTextWithToast } from "@/lib/interaction-feedback"
import { validatePublicSlug } from "@/lib/visibility"

type ProfileForm = {
  userId: string
  displayName: string
  avatarText: string
  avatarUrl: string
  avatarDataUrl: string
  location: string
  bio: string
  email: string
  publicSlug: string
}

function initials(name: string) {
  const value = name.trim()
  return (value ? Array.from(value).slice(0, 2).join("") : "ME").toUpperCase()
}

export function ProfileSettingsForm({
  initialForm,
  labels,
}: {
  initialForm: ProfileForm
  labels: {
    displayName: string
    avatarText: string
    avatarUpload: string
    location: string
    bio: string
    email: string
    publicSlug: string
    publicSlugHint: string
    copyPublicLink: string
    publicLinkCopied: string
    publicLinkCopyFailed: string
    save: string
    saving: string
    saved: string
    saveFailed: string
    avatarImageOnly: string
    avatarTooLarge: string
  }
}) {
  const router = useRouter()
  const [form, setForm] = useState(initialForm)
  const [saving, setSaving] = useState(false)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarObjectUrl, setAvatarObjectUrl] = useState("")

  const fallbackAvatar = useMemo(
    () => form.avatarText.trim() || initials(form.displayName),
    [form.avatarText, form.displayName]
  )
  const avatarPreview = avatarObjectUrl || form.avatarDataUrl || form.avatarUrl

  async function handleCopyPublicLink() {
    const slug = form.publicSlug.trim().toLowerCase()
    if (slug) {
      const validation = validatePublicSlug(slug)
      if (!validation.ok) {
        toast.error(validation.reason)
        return
      }
    }

    const origin = window.location.origin
    const ref = slug || form.userId
    await copyTextWithToast(`${origin}/u/${ref}`, labels.publicLinkCopied, labels.publicLinkCopyFailed)
  }

  function handleAvatarFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith("image/")) {
      toast.error(labels.avatarImageOnly)
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error(labels.avatarTooLarge)
      return
    }
    setAvatarFile(file)
    setForm((current) => ({ ...current, avatarDataUrl: "" }))
    setAvatarObjectUrl((current) => {
      if (current) URL.revokeObjectURL(current)
      return URL.createObjectURL(file)
    })
  }

  async function handleSave() {
    setSaving(true)
    try {
      const displayName = form.displayName.trim()
      const avatarText = form.avatarText.trim() || initials(displayName)
      let avatarUrl = form.avatarUrl || undefined

      if (avatarFile) {
        const uploadForm = new FormData()
        uploadForm.set("file", avatarFile)
        const uploadRes = await fetch("/api/upload", {
          method: "POST",
          body: uploadForm,
          cache: "no-store",
        })
        const uploadData = await uploadRes.json().catch(() => null)
        if (!uploadRes.ok || !uploadData?.url) {
          throw new Error(uploadData?.error ?? labels.saveFailed)
        }
        avatarUrl = uploadData.url
      }

      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName,
          ownerName: displayName,
          heroTagline: form.bio,
          avatarText,
          avatarUrl,
          location: form.location.trim(),
          bio: form.bio.trim(),
          email: form.email.trim().toLowerCase(),
          publicSlug: form.publicSlug.trim().toLowerCase(),
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error ?? labels.saveFailed)
      }

      toast.success(labels.saved)
      setAvatarFile(null)
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : labels.saveFailed)
    } finally {
      setSaving(false)
    }
  }

  return (
    <SettingsSection
      icon={<UserCircle size={16} />}
      title={labels.displayName}
      description={labels.bio ? undefined : undefined}
      footer={
        <Button type="button" onClick={handleSave} loading={saving} loadingText={labels.saving}>
          {labels.save}
        </Button>
      }
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:gap-6">
        <div className="flex flex-col items-center gap-3 sm:items-start">
          <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-full border border-[--color-border] bg-gradient-to-br from-[#eef0f3] to-[#dde2eb] shadow-[--shadow-profile-card]">
            {avatarPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarPreview} alt="avatar preview" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xl font-semibold text-[--color-text-primary]">
                {fallbackAvatar}
              </div>
            )}
          </div>
          <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border border-[--color-border-strong] bg-[--color-bg-surface] px-4 py-1.5 text-xs font-medium text-[--color-text-primary] transition-colors hover:border-[--color-brand-border] hover:bg-[--color-bg-hover]">
            <Upload size={14} />
            {labels.avatarUpload}
            <input type="file" accept="image/*" className="hidden" onChange={handleAvatarFile} />
          </label>
        </div>
        <div className="flex-1 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label className="mb-2 block">{labels.displayName}</Label>
              <Input value={form.displayName} onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))} />
            </div>
            <div>
              <Label className="mb-2 block">{labels.avatarText}</Label>
              <Input
                value={form.avatarText}
                onChange={(e) => setForm((f) => ({ ...f, avatarText: e.target.value }))}
                maxLength={20}
                placeholder={initials(form.displayName)}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label className="mb-2 block">{labels.location}</Label>
              <Input value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} />
            </div>
            <div>
              <Label className="mb-2 block">{labels.email}</Label>
              <Input value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            </div>
          </div>

          <div>
            <Label className="mb-2 flex items-center gap-1.5 text-[13px]">
              <IdCard size={13} className="text-[--color-text-muted]" />
              {labels.publicSlug}
            </Label>
            <div className="relative">
              <Input
                value={form.publicSlug}
                onChange={(e) => setForm((f) => ({ ...f, publicSlug: e.target.value.toLowerCase() }))}
                placeholder="your-public-name"
                maxLength={32}
                className="pr-11"
              />
              <button
                type="button"
                onClick={handleCopyPublicLink}
                className="absolute right-1.5 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-[--color-text-muted] transition hover:bg-[--color-bg-hover] hover:text-[--color-text-primary] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-brand]"
                title={labels.copyPublicLink}
                aria-label={labels.copyPublicLink}
              >
                <Copy size={15} />
              </button>
            </div>
            <p className="mt-2 text-xs leading-5 text-[--color-text-muted]">{labels.publicSlugHint}</p>
          </div>

          <div>
            <Label className="mb-2 block">{labels.bio}</Label>
            <Textarea value={form.bio} onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))} rows={5} />
          </div>
        </div>
      </div>
    </SettingsSection>
  )
}
