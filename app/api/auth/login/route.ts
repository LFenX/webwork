import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/db"
import { startUserSession } from "@/lib/session"
import { loginSchema } from "@/lib/validators"
import { normalizeUserRole, recordActivity } from "@/lib/admin"

export const dynamic = "force-dynamic"

const NO_STORE = { "Cache-Control": "no-store" }

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const parsed = loginSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: "请输入邮箱和密码" }, { status: 400, headers: NO_STORE })
  }

  const { email, password } = parsed.data
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    return NextResponse.json({ error: "邮箱或密码不正确" }, { status: 401, headers: NO_STORE })
  }

  const ok = await bcrypt.compare(password, user.passwordHash)
  if (!ok) {
    return NextResponse.json({ error: "邮箱或密码不正确" }, { status: 401, headers: NO_STORE })
  }

  const normalizedUser = await normalizeUserRole(user)
  await prisma.user.update({
    where: { id: normalizedUser.id },
    data: { lastLoginAt: new Date() },
  })
  await recordActivity(normalizedUser.id, "login", "登录", req)
  await startUserSession({ userId: normalizedUser.id, email: normalizedUser.email, req })

  return NextResponse.json({ ok: true }, { headers: NO_STORE })
}
