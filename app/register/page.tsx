import { getOptionalSession } from "@/lib/auth"
import { redirect } from "next/navigation"
import { RegisterForm } from "./register-form"

export const metadata = { title: "注册" }

export default async function RegisterPage() {
  const session = await getOptionalSession()
  if (session) redirect("/")
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="w-full max-w-[380px]">
        <h1 className="text-2xl font-semibold mb-1">创建账号</h1>
        <p className="text-sm text-[--color-text-muted] mb-8">开始你的个人空间</p>
        <RegisterForm />
        <p className="mt-6 text-sm text-center text-[--color-text-muted]">
          已有账号？{" "}
          <a href="/login" className="text-[--color-link] hover:underline">登录</a>
        </p>
      </div>
    </div>
  )
}
