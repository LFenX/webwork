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
  return (value ? Array.from(value).slice(0, 2).join("") : "我").toUpperCase()
}

export function SettingsDialog({ ownerName, heroTagline, email }: SettingsDialogProps) {
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
      toast.error("请选择图片文件")
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("头像图片不能超过 5MB")
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
          throw new Error(uploadData?.error ?? "头像上传失败")
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
        throw new Error(data?.error ?? "保存失败")
      }
      toast.success("用户信息已保存")
      setAvatarFile(null)
      setAvatarObjectUrl((current) => {
        if (current) URL.revokeObjectURL(current)
        return ""
      })
      setOpen(false)
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存失败")
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
      if (!res.ok) throw new Error(data?.error ?? "提交失败")
      setPassword("")
      toast.success("密码修改申请已提交，等待管理员同意")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "提交失败")
    } finally {
      setRequestingPassword(false)
    }
  }

  async function checkPasswordStatus() {
    try {
      const res = await fetch("/api/auth/password-change", { cache: "no-store" })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error ?? "查询失败")
      if (!data?.request) {
        toast.info("还没有密码修改申请")
      } else if (data.request.status === "approved") {
        toast.success("管理员已同意，新密码已经生效")
      } else if (data.request.status === "pending") {
        toast.info("申请仍在等待管理员审核")
      } else {
        toast.info("最近的密码申请未生效")
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "查询失败")
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="p-1.5 text-[--color-text-muted] hover:text-[--color-text-primary] hover:bg-[--color-bg-hover] rounded transition-colors"
        title="用户信息设置"
      >
        <Settings size={15} />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>用户信息设置</DialogTitle>
          </DialogHeader>
          <div className="mt-2 space-y-4 sm:space-y-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
              <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full border border-[--color-border] bg-[--color-bg-hover]">
                {avatarPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarPreview} alt="头像预览" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xl font-semibold text-[--color-text-primary]">
                    {fallbackAvatar}
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-3">
                <div>
                  <Label className="mb-1 block text-xs">昵称</Label>
                  <Input
                    value={form.displayName}
                    onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
                    placeholder="你的昵称"
                    className="h-9 text-sm"
                  />
                </div>
                <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                  <div className="min-w-0">
                    <Label className="mb-1 block text-xs">默认头像文字</Label>
                    <Input
                      value={form.avatarText}
                      onChange={(e) => setForm((f) => ({ ...f, avatarText: e.target.value }))}
                      maxLength={20}
                      className="h-9 text-sm"
                      placeholder={initials(form.displayName)}
                    />
                  </div>
                  <label className="inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-[--radius-sm] border border-[--color-border-strong] px-3 text-sm hover:bg-[--color-bg-hover] sm:mt-5">
                    <Upload size={14} /> 上传
                    <input type="file" accept="image/*" className="hidden" onChange={handleAvatarFile} />
                  </label>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="min-w-0">
                <Label className="mb-1 block text-xs">地区</Label>
                <Input
                  value={form.location}
                  onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                  placeholder="例如：中国上海"
                  className="h-9 text-sm"
                />
              </div>
              <div className="min-w-0">
                <Label className="mb-1 block text-xs">邮箱</Label>
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
              <Label className="mb-1 block text-xs">个性签名</Label>
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
                <KeyRound size={15} /> 修改密码
              </div>
              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
                <Input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type="password"
                  minLength={8}
                  placeholder="先输入新密码，提交给管理员审核"
                  className="h-9 text-sm"
                />
                <Button className="w-full sm:w-auto" size="sm" variant="outline" onClick={requestPasswordChange} disabled={requestingPassword || password.length < 8}>
                  提交申请
                </Button>
                <Button className="w-full sm:w-auto" size="sm" variant="outline" onClick={checkPasswordStatus}>
                  查看是否生效
                </Button>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setOpen(false)}>取消</Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? "保存中..." : "保存"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
