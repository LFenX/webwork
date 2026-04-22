"use client"

import { FormEvent, useRef, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function RegisterForm() {
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
      setError("网络错误，请稍后再试")
      setPending(false)
      return
    }

    if (!res.ok) {
      const data = await res.json().catch(() => null)
      setError(data?.error ?? "注册失败，请稍后再试")
      setPending(false)
      return
    }

    const data = await res.json().catch(() => null)
    window.localStorage.setItem("pendingRegistrationEmail", email)
    setLastEmail(email)
    setMessage(data?.message ?? "注册申请已提交，等待管理员审核。")
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
      setError("请输入注册邮箱后再查看审核状态")
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
      setError("网络错误，请稍后再试")
      setChecking(false)
      return
    }

    const data = await res.json().catch(() => null)
    if (!res.ok) {
      setError(data?.message ?? data?.error ?? "没有找到该邮箱的注册申请")
      setChecking(false)
      return
    }

    if (data?.status === "approved") {
      window.localStorage.removeItem("pendingRegistrationEmail")
      setApproved(true)
      setMessage(data.message ?? "注册已通过，请登录。")
    } else {
      setLastEmail(email)
      setMessage(data?.message ?? "注册申请仍在等待审核。")
    }
    setChecking(false)
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label className="text-xs mb-1 block">昵称</Label>
        <Input name="displayName" placeholder="你的名字" autoComplete="name" required />
      </div>
      <div>
        <Label className="text-xs mb-1 block">邮箱</Label>
        <Input name="email" type="email" placeholder="you@example.com" autoComplete="email" required />
      </div>
      <div>
        <Label className="text-xs mb-1 block">密码（至少 8 位）</Label>
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
          去登录
        </Link>
      )}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "提交中…" : "提交注册申请"}
      </Button>
      <Button type="button" variant="outline" className="w-full" disabled={checking} onClick={handleCheckStatus}>
        {checking ? "查询中…" : "查看审核状态"}
      </Button>
    </form>
  )
}
