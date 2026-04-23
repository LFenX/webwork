"use client"

import { type ChangeEvent, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Upload } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

type ProfileForm = {
  displayName: string
  avatarText: string
  avatarUrl: string
  avatarDataUrl: string
  location: string
  bio: string
  email: string
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
    <section className="rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface] p-5">
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-full border border-[--color-border] bg-[--color-bg-hover]">
          {avatarPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarPreview} alt="avatar preview" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xl font-semibold text-[--color-text-primary]">
              {fallbackAvatar}
            </div>
          )}
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
          <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-[--radius-sm] border border-[--color-border-strong] px-4 text-sm hover:bg-[--color-bg-hover]">
            <Upload size={15} />
            {labels.avatarUpload}
            <input type="file" accept="image/*" className="hidden" onChange={handleAvatarFile} />
          </label>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div>
          <Label className="mb-2 block">{labels.location}</Label>
          <Input value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} />
        </div>
        <div>
          <Label className="mb-2 block">{labels.email}</Label>
          <Input value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
        </div>
      </div>

      <div className="mt-4">
        <Label className="mb-2 block">{labels.bio}</Label>
        <Textarea value={form.bio} onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))} rows={5} />
      </div>

      <div className="mt-6 flex justify-end">
        <Button type="button" onClick={handleSave} disabled={saving}>
          {saving ? labels.saving : labels.save}
        </Button>
      </div>
    </section>
  )
}
