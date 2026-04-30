"use client"

import { useMemo, useState } from "react"
import { Eye, EyeOff } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function PasswordSettingsPanel({
  labels,
}: {
  labels: {
    passwordInput: string
    passwordConfirm: string
    passwordSubmit: string
    passwordStatus: string
    passwordRequested: string
    passwordRequestFailed: string
    passwordNoRequest: string
    passwordApproved: string
    passwordPending: string
    passwordRejected: string
    passwordMismatch: string
    showPassword: string
    hidePassword: string
  }
}) {
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [requesting, setRequesting] = useState(false)
  const [checking, setChecking] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const canSubmit = useMemo(
    () => password.length >= 8 && confirmPassword.length >= 8 && password === confirmPassword,
    [confirmPassword, password]
  )

  async function requestPasswordChange() {
    if (password !== confirmPassword) {
      toast.error(labels.passwordMismatch)
      return
    }

    setRequesting(true)
    try {
      const res = await fetch("/api/auth/password-change", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, confirmPassword }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error ?? labels.passwordRequestFailed)
      setPassword("")
      setConfirmPassword("")
      toast.success(labels.passwordRequested)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : labels.passwordRequestFailed)
    } finally {
      setRequesting(false)
    }
  }

  async function checkPasswordStatus() {
    setChecking(true)
    try {
      const res = await fetch("/api/auth/password-change", { cache: "no-store" })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error ?? labels.passwordRequestFailed)
      if (!data?.request) {
        toast.info(labels.passwordNoRequest)
      } else if (data.request.status === "approved") {
        toast.success(labels.passwordApproved)
      } else if (data.request.status === "pending") {
        toast.info(labels.passwordPending)
      } else {
        toast.info(labels.passwordRejected)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : labels.passwordRequestFailed)
    } finally {
      setChecking(false)
    }
  }

  return (
    <section className="rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface] p-5">
      <div className="max-w-lg space-y-4">
        <div>
          <Label className="mb-2 block">{labels.passwordInput}</Label>
          <div className="relative">
            <Input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} />
            <button
              type="button"
              aria-label={showPassword ? labels.hidePassword : labels.showPassword}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[--color-text-muted]"
              onClick={() => setShowPassword((value) => !value)}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>
        <div>
          <Label className="mb-2 block">{labels.passwordConfirm}</Label>
          <Input type={showPassword ? "text" : "password"} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
        </div>
      </div>
      <div className="mt-6 flex flex-wrap gap-3">
        <Button type="button" onClick={requestPasswordChange} disabled={!canSubmit} loading={requesting} loadingText="提交中...">
          {labels.passwordSubmit}
        </Button>
        <Button type="button" variant="outline" onClick={checkPasswordStatus} loading={checking} loadingText="查询中...">
          {labels.passwordStatus}
        </Button>
      </div>
    </section>
  )
}
