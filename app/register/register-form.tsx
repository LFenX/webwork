"use client"

import { useActionState } from "react"
import { register } from "@/app/actions/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function RegisterForm() {
  const [state, action, pending] = useActionState(register, undefined)

  return (
    <form action={action} className="space-y-4">
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
      {state?.error && (
        <p className="text-sm text-[--color-danger]">{state.error}</p>
      )}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "创建中…" : "创建账号"}
      </Button>
    </form>
  )
}
