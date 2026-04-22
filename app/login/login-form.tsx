"use client"

import { FormEvent, useState } from "react"
import { Eye, EyeOff, KeyRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function LoginForm() {
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
      setError("网络错误，请稍后再试")
      setPending(false)
      return
    }

    if (!res.ok) {
      const data = await res.json().catch(() => null)
      setError(data?.error ?? "登录失败，请稍后再试")
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
        body: JSON.stringify({ email: resetEmail, password: newPassword }),
        cache: "no-store",
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error ?? "提交失败")
      setNewPassword("")
      setMessage("密码修改申请已提交，等待管理员同意")
    } catch (err) {
      setError(err instanceof Error ? err.message : "提交失败")
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
      if (!res.ok) throw new Error(data?.error ?? "查询失败")
      if (!data?.request) {
        setMessage("还没有找到这个邮箱的密码修改申请")
      } else if (data.request.status === "approved") {
        setMessage("管理员已同意，新密码已经生效，可以直接登录")
      } else if (data.request.status === "pending") {
        setMessage("申请仍在等待管理员审核")
      } else {
        setMessage("最近的密码申请未生效")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "查询失败")
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label className="mb-1 block text-xs">邮箱</Label>
          <Input name="email" type="email" placeholder="you@example.com" autoComplete="email" required />
        </div>
        <div>
          <Label className="mb-1 block text-xs">密码</Label>
          <div className="relative">
            <Input
              name="password"
              type={showPassword ? "text" : "password"}
              placeholder="请输入密码"
              autoComplete="current-password"
              required
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-[--color-text-muted] hover:bg-[--color-bg-hover] hover:text-[--color-text-primary]"
              title={showPassword ? "隐藏密码" : "显示密码"}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>
        {error && <p className="text-sm text-[--color-danger]">{error}</p>}
        {message && <p className="text-sm text-[--color-text-secondary]">{message}</p>}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "登录中..." : "登录"}
        </Button>
      </form>

      <button
        type="button"
        onClick={() => setResetOpen((value) => !value)}
        className="inline-flex w-full items-center justify-center gap-1.5 text-sm text-[--color-link] hover:underline"
      >
        <KeyRound size={14} /> 修改或找回密码
      </button>

      {resetOpen && (
        <div className="space-y-3 rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface] p-3">
          <div>
            <Label className="mb-1 block text-xs">注册邮箱</Label>
            <Input
              value={resetEmail}
              onChange={(event) => setResetEmail(event.target.value)}
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
            />
          </div>
          <div>
            <Label className="mb-1 block text-xs">新密码（至少 8 位）</Label>
            <Input
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              type="text"
              minLength={8}
              placeholder="输入希望设置的新密码"
              autoComplete="new-password"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant="outline" size="sm" onClick={requestPasswordChange} disabled={resetPending || !resetEmail || newPassword.length < 8}>
              {resetPending ? "提交中..." : "提交申请"}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={checkPasswordStatus} disabled={checking || !resetEmail}>
              {checking ? "查询中..." : "查看是否生效"}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
