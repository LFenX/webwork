"use client"

import { useActionState } from "react"
import { login } from "@/app/actions/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function LoginForm() {
  const [state, action, pending] = useActionState(login, undefined)

  return (
    <form action={action} className="space-y-4">
      <div>
        <Label className="text-xs mb-1 block">邮箱</Label>
        <Input name="email" type="email" placeholder="you@example.com" autoComplete="email" required />
      </div>
      <div>
        <Label className="text-xs mb-1 block">密码</Label>
        <Input name="password" type="password" placeholder="••••••••" autoComplete="current-password" required />
      </div>
      {state?.error && (
        <p className="text-sm text-[--color-danger]">{state.error}</p>
      )}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "登录中…" : "登录"}
      </Button>
    </form>
  )
}
