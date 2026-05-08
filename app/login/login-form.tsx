"use client"

import { FormEvent, useState } from "react"
import { Eye, EyeOff, KeyRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getDict } from "@/lib/i18n"

export function LoginForm() {
  const dict = getDict()
  const a = dict.auth
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)
  const [resetEmail, setResetEmail] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [resetPending, setResetPending] = useState(false)
  const [checking, setChecking] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setMessage(null)
    setPending(true)

    const form = new FormData(event.currentTarget)
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: form.get("email"),
        password: form.get("password"),
      }),
      cache: "no-store",
    }).catch(() => null)

    if (!res) {
      setError(a.networkError)
      setPending(false)
      return
    }

    if (!res.ok) {
      const data = await res.json().catch(() => null)
      setError(data?.error ?? a.loginFailed)
      setPending(false)
      return
    }

    window.location.assign("/")
  }

  async function requestPasswordChange() {
    setError(null)
    setMessage(null)
    setResetPending(true)
    try {
      const res = await fetch("/api/auth/password-change", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resetEmail, password: newPassword, confirmPassword: newPassword }),
        cache: "no-store",
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error ?? a.requestFailed)
      setNewPassword("")
      setMessage(a.passwordChangeSubmitted)
    } catch (err) {
      setError(err instanceof Error ? err.message : a.requestFailed)
    } finally {
      setResetPending(false)
    }
  }

  async function checkPasswordStatus() {
    setError(null)
    setMessage(null)
    setChecking(true)
    try {
      const res = await fetch("/api/auth/password-change-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resetEmail }),
        cache: "no-store",
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error ?? a.checkFailed)
      if (!data?.request) {
        setMessage(a.noRequest)
      } else if (data.request.status === "approved") {
        setMessage(a.approved)
      } else if (data.request.status === "pending") {
        setMessage(a.pending)
      } else {
        setMessage(a.rejected)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : a.checkFailed)
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label className="mb-1 block text-xs">{a.email}</Label>
          <Input name="email" type="email" placeholder="you@example.com" autoComplete="email" required />
        </div>
        <div>
          <Label className="mb-1 block text-xs">{a.password}</Label>
          <div className="relative">
            <Input
              name="password"
              type={showPassword ? "text" : "password"}
              placeholder={a.passwordPlaceholder}
              autoComplete="current-password"
              required
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-[--color-text-muted] hover:bg-[--color-bg-hover] hover:text-[--color-text-primary]"
              title={showPassword ? a.hidePassword : a.showPassword}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>
        {error && <p className="text-sm text-[--color-danger]">{error}</p>}
        {message && <p className="text-sm text-[--color-text-secondary]">{message}</p>}
        <Button type="submit" className="w-full" loading={pending} loadingText={a.loggingIn}>
          {a.login}
        </Button>
      </form>

      <button
        type="button"
        onClick={() => setResetOpen((value) => !value)}
        className="inline-flex w-full items-center justify-center gap-1.5 text-sm text-[--color-link] hover:underline"
      >
        <KeyRound size={14} /> {a.resetPassword}
      </button>

      {resetOpen && (
        <div className="space-y-3 rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface] p-3">
          <div>
            <Label className="mb-1 block text-xs">{a.registerEmail}</Label>
            <Input
              value={resetEmail}
              onChange={(event) => setResetEmail(event.target.value)}
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
            />
          </div>
          <div>
            <Label className="mb-1 block text-xs">{a.newPasswordMin}</Label>
            <Input
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              type="text"
              minLength={8}
              placeholder={a.newPasswordPlaceholder}
              autoComplete="new-password"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant="outline" size="sm" onClick={requestPasswordChange} disabled={!resetEmail || newPassword.length < 8} loading={resetPending} loadingText={a.submitting}>
              {a.submitRequest}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={checkPasswordStatus} disabled={!resetEmail} loading={checking} loadingText={a.checking}>
              {a.checkStatus}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
