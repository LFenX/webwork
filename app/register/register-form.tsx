"use client"

import { FormEvent, useRef, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getDict } from "@/lib/i18n"

export function RegisterForm() {
  const dict = getDict()
  const a = dict.auth
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [lastEmail, setLastEmail] = useState("")
  const [pending, setPending] = useState(false)
  const [checking, setChecking] = useState(false)
  const [approved, setApproved] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setMessage(null)
    setApproved(false)
    setPending(true)

    const form = new FormData(event.currentTarget)
    const email = String(form.get("email") ?? "").trim().toLowerCase()
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        displayName: form.get("displayName"),
        email,
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
      setError(data?.error ?? a.registrationFailed)
      setPending(false)
      return
    }

    const data = await res.json().catch(() => null)
    window.localStorage.setItem("pendingRegistrationEmail", email)
    setLastEmail(email)
    setMessage(data?.message ?? a.registrationSubmitted)
    setPending(false)
  }

  async function handleCheckStatus() {
    setError(null)
    setMessage(null)
    setApproved(false)
    setChecking(true)

    const form = formRef.current ? new FormData(formRef.current) : null
    const storedEmail = window.localStorage.getItem("pendingRegistrationEmail") ?? ""
    const email = String(form?.get("email") || lastEmail || storedEmail).trim().toLowerCase()

    if (!email) {
      setError(a.noEmail)
      setChecking(false)
      return
    }

    const res = await fetch("/api/auth/registration-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
      cache: "no-store",
    }).catch(() => null)

    if (!res) {
      setError(a.networkError)
      setChecking(false)
      return
    }

    const data = await res.json().catch(() => null)
    if (!res.ok) {
      setError(data?.message ?? data?.error ?? a.checkFailed)
      setChecking(false)
      return
    }

    if (data?.status === "approved") {
      window.localStorage.removeItem("pendingRegistrationEmail")
      setApproved(true)
      setMessage(data.message ?? "Registration approved. Please log in.")
    } else {
      setLastEmail(email)
      setMessage(data?.message ?? a.pending)
    }
    setChecking(false)
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label className="text-xs mb-1 block">{a.nickname}</Label>
        <Input name="displayName" placeholder={a.namePlaceholder} autoComplete="name" required />
      </div>
      <div>
        <Label className="text-xs mb-1 block">{a.email}</Label>
        <Input name="email" type="email" placeholder="you@example.com" autoComplete="email" required />
      </div>
      <div>
        <Label className="text-xs mb-1 block">{a.passwordMin}</Label>
        <Input name="password" type="password" placeholder="••••••••" autoComplete="new-password" required />
      </div>
      {error && (
        <p className="text-sm text-[--color-danger]">{error}</p>
      )}
      {message && (
        <p className="text-sm text-[--color-text-secondary]">{message}</p>
      )}
      {approved && (
        <Link href="/login" className="block text-sm text-center text-[--color-link] hover:underline">
          {a.goToLogin}
        </Link>
      )}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? a.submitting : a.submitRegistration}
      </Button>
      <Button type="button" variant="outline" className="w-full" disabled={checking} onClick={handleCheckStatus}>
        {checking ? a.checking : a.checkApproval}
      </Button>
    </form>
  )
}
