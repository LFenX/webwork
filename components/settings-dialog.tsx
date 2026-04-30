"use client"

import { ChangeEvent, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { KeyRound, Settings, Upload } from "lucide-react"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { getDict } from "@/lib/i18n"

interface SettingsDialogProps {
  ownerName: string
  heroTagline: string
  email: string
}

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
  return (value ? Array.from(value).slice(0, 2).join("") : "?").toUpperCase()
}

export function SettingsDialog({ ownerName, heroTagline, email }: SettingsDialogProps) {
  const dict = getDict()
  const s = dict.settings
  const a = dict.auth
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<ProfileForm>({
    displayName: ownerName,
    avatarText: initials(ownerName),
    avatarUrl: "",
    avatarDataUrl: "",
    location: "",
    bio: heroTagline,
    email,
  })
  const [password, setPassword] = useState("")
  const [saving, setSaving] = useState(false)
  const [requestingPassword, setRequestingPassword] = useState(false)
  const [checkingPassword, setCheckingPassword] = useState(false)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarObjectUrl, setAvatarObjectUrl] = useState("")

  const fallbackAvatar = useMemo(
    () => form.avatarText.trim() || initials(form.displayName),
    [form.avatarText, form.displayName]
  )
  const avatarPreview = avatarObjectUrl || form.avatarDataUrl || form.avatarUrl

  useEffect(() => {
    return () => {
      if (avatarObjectUrl) URL.revokeObjectURL(avatarObjectUrl)
    }
  }, [avatarObjectUrl])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    fetch("/api/settings", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data?.user) return
        const displayName = data.user.displayName || data.ownerName || ownerName
        setForm({
          displayName,
          avatarText: data.user.avatarText || initials(displayName),
          avatarUrl: data.user.avatarUrl || "",
          avatarDataUrl: "",
          location: data.user.location || "",
          bio: data.user.bio || data.heroTagline || "",
          email: data.user.email || email,
        })
        setAvatarFile(null)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [open, ownerName, email])

  function handleAvatarFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith("image/")) {
      toast.error(s.avatarImageOnly)
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error(s.avatarTooLarge)
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
          throw new Error(uploadData?.error ?? s.profileSaveFailed)
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
        throw new Error(data?.error ?? s.profileSaveFailed)
      }
      toast.success(s.profileSaved)
      setAvatarFile(null)
      setAvatarObjectUrl((current) => {
        if (current) URL.revokeObjectURL(current)
        return ""
      })
      setOpen(false)
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : s.profileSaveFailed)
    } finally {
      setSaving(false)
    }
  }

  async function requestPasswordChange() {
    setRequestingPassword(true)
    try {
      const res = await fetch("/api/auth/password-change", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error ?? a.requestFailed)
      setPassword("")
      toast.success(s.passwordRequested)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : a.requestFailed)
    } finally {
      setRequestingPassword(false)
    }
  }

  async function checkPasswordStatus() {
    setCheckingPassword(true)
    try {
      const res = await fetch("/api/auth/password-change", { cache: "no-store" })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error ?? a.checkFailed)
      if (!data?.request) {
        toast.info(s.passwordNoRequest)
      } else if (data.request.status === "approved") {
        toast.success(s.passwordApproved)
      } else if (data.request.status === "pending") {
        toast.info(s.passwordPending)
      } else {
        toast.info(s.passwordRejected)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : a.checkFailed)
    } finally {
      setCheckingPassword(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="p-1.5 text-[--color-text-muted] hover:text-[--color-text-primary] hover:bg-[--color-bg-hover] rounded transition-colors"
        title={dict.common.settings}
      >
        <Settings size={15} />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>{s.profileTitle}</DialogTitle>
          </DialogHeader>
          <div className="mt-2 space-y-4 sm:space-y-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
              <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full border border-[--color-border] bg-[--color-bg-hover]">
                {avatarPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarPreview} alt="avatar preview" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xl font-semibold text-[--color-text-primary]">
                    {fallbackAvatar}
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-3">
                <div>
                  <Label className="mb-1 block text-xs">{s.displayName}</Label>
                  <Input
                    value={form.displayName}
                    onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
                    placeholder={dict.settings.nickname}
                    className="h-9 text-sm"
                  />
                </div>
                <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                  <div className="min-w-0">
                    <Label className="mb-1 block text-xs">{s.avatarText}</Label>
                    <Input
                      value={form.avatarText}
                      onChange={(e) => setForm((f) => ({ ...f, avatarText: e.target.value }))}
                      maxLength={20}
                      className="h-9 text-sm"
                      placeholder={initials(form.displayName)}
                    />
                  </div>
                  <label className="inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-[--radius-sm] border border-[--color-border-strong] px-3 text-sm hover:bg-[--color-bg-hover] sm:mt-5">
                    <Upload size={14} /> {s.avatarUpload}
                    <input type="file" accept="image/*" className="hidden" onChange={handleAvatarFile} />
                  </label>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="min-w-0">
                <Label className="mb-1 block text-xs">{s.location}</Label>
                <Input
                  value={form.location}
                  onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                  placeholder={dict.common.none}
                  className="h-9 text-sm"
                />
              </div>
              <div className="min-w-0">
                <Label className="mb-1 block text-xs">{s.email}</Label>
                <Input
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  type="email"
                  placeholder="you@example.com"
                  className="h-9 text-sm"
                />
              </div>
            </div>
            <div>
              <Label className="mb-1 block text-xs">{dict.settings.signature ?? "Signature"}</Label>
              <Textarea
                value={form.bio}
                onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
                rows={3}
                maxLength={200}
                className="resize-none text-sm"
              />
            </div>

            <div className="rounded-[--radius-lg] border border-[--color-border] p-3">
              <div className="mb-3 flex items-center gap-2 text-sm font-medium">
                <KeyRound size={15} /> {dict.settings.changePassword ?? "Change password"}
              </div>
              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
                <Input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type="password"
                  minLength={8}
                  placeholder={s.passwordInput}
                  className="h-9 text-sm"
                />
                <Button className="w-full sm:w-auto" size="sm" variant="outline" onClick={requestPasswordChange} disabled={password.length < 8} loading={requestingPassword} loadingText={dict.common.saving}>
                  {s.passwordSubmit}
                </Button>
                <Button className="w-full sm:w-auto" size="sm" variant="outline" onClick={checkPasswordStatus} loading={checkingPassword} loadingText={dict.common.loading}>
                  {s.passwordStatus}
                </Button>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setOpen(false)}>{dict.common.cancel}</Button>
              <Button size="sm" onClick={handleSave} loading={saving} loadingText={dict.common.saving}>
                {dict.common.save}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
