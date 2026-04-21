"use server"

import bcrypt from "bcryptjs"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import { createSession, deleteSession } from "@/lib/session"
import { registerSchema, loginSchema } from "@/lib/validators"

export type AuthState = { error?: string } | undefined

export async function register(prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = registerSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    displayName: formData.get("displayName"),
  })
  if (!parsed.success) {
    const errs = parsed.error.flatten().fieldErrors
    const msg = Object.values(errs).flat()[0] ?? "输入不合法"
    return { error: msg }
  }
  const { email, password, displayName } = parsed.data

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) return { error: "该邮箱已注册" }

  const passwordHash = await bcrypt.hash(password, 10)
  const user = await prisma.user.create({
    data: { email, passwordHash, displayName },
  })

  await createSession({ userId: user.id, email: user.email })
  redirect("/")
}

export async function login(prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  })
  if (!parsed.success) return { error: "请输入邮箱和密码" }
  const { email, password } = parsed.data

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) return { error: "邮箱或密码不正确" }

  const ok = await bcrypt.compare(password, user.passwordHash)
  if (!ok) return { error: "邮箱或密码不正确" }

  await createSession({ userId: user.id, email: user.email })
  redirect("/")
}

export async function logout() {
  await deleteSession()
  redirect("/login")
}
