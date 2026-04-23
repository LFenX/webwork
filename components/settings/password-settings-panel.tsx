"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function PasswordSettingsPanel({
  labels,
}: {
  labels: {
    passwordInput: string
    passwordSubmit: string
    passwordStatus: string
    passwordRequested: string
    passwordRequestFailed: string
    passwordNoRequest: string
    passwordApproved: string
    passwordPending: string
    passwordRejected: string
  }
}) {
  const [password, setPassword] = useState("")
  const [requesting, setRequesting] = useState(false)

  async function requestPasswordChange() {
    setRequesting(true)
    try {
      const res = await fetch("/api/auth/password-change", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error ?? labels.passwordRequestFailed)
      setPassword("")
      toast.success(labels.passwordRequested)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : labels.passwordRequestFailed)
    } finally {
      setRequesting(false)
    }
  }

  async function checkPasswordStatus() {
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
    }
  }

  return (
    <section className="rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface] p-5">
      <div className="max-w-lg">
        <Label className="mb-2 block">{labels.passwordInput}</Label>
        <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <div className="mt-6 flex flex-wrap gap-3">
        <Button type="button" onClick={requestPasswordChange} disabled={requesting || password.length < 8}>
          {labels.passwordSubmit}
        </Button>
        <Button type="button" variant="outline" onClick={checkPasswordStatus}>
          {labels.passwordStatus}
        </Button>
      </div>
    </section>
  )
}
