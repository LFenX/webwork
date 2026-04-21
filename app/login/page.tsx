import { getOptionalSession } from "@/lib/auth"
import { redirect } from "next/navigation"
import { LoginForm } from "./login-form"

export const metadata = { title: "登录" }

export default async function LoginPage() {
  const session = await getOptionalSession()
  if (session) redirect("/")
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="w-full max-w-[380px]">
        <h1 className="text-2xl font-semibold mb-1">登录</h1>
        <p className="text-sm text-[--color-text-muted] mb-8">登录到你的个人空间</p>
        <LoginForm />
        <p className="mt-6 text-sm text-center text-[--color-text-muted]">
          还没有账号？{" "}
          <a href="/register" className="text-[--color-link] hover:underline">注册</a>
        </p>
      </div>
    </div>
  )
}
