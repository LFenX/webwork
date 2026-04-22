import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { loginSchema } from "@/lib/validators"

export const dynamic = "force-dynamic"

const NO_STORE = { "Cache-Control": "no-store" }

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const email = loginSchema.shape.email.safeParse(body?.email)

  if (!email.success) {
    return NextResponse.json({ error: "请输入有效邮箱" }, { status: 400, headers: NO_STORE })
  }

  const user = await prisma.user.findUnique({ where: { email: email.data } })
  if (user) {
    return NextResponse.json({ status: "approved", message: "注册已通过，请登录。" }, { headers: NO_STORE })
  }

  const request = await prisma.registrationRequest.findUnique({ where: { email: email.data } })
  if (!request) {
    return NextResponse.json({ status: "none", message: "没有找到该邮箱的注册申请。" }, { status: 404, headers: NO_STORE })
  }

  return NextResponse.json(
    {
      status: request.status,
      message: request.status === "pending" ? "注册申请仍在等待审核。" : "注册状态已更新。",
    },
    { headers: NO_STORE }
  )
}
