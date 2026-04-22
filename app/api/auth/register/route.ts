import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import crypto from "node:crypto"
import { prisma } from "@/lib/db"
import { registerSchema } from "@/lib/validators"

export const dynamic = "force-dynamic"

const NO_STORE = { "Cache-Control": "no-store" }

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const parsed = registerSchema.safeParse(body)

  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors
    const message = Object.values(errors).flat()[0] ?? "输入不合法"
    return NextResponse.json({ error: message }, { status: 400, headers: NO_STORE })
  }

  const { email, password, displayName } = parsed.data
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    return NextResponse.json({ error: "该邮箱已注册" }, { status: 409, headers: NO_STORE })
  }

  const passwordHash = await bcrypt.hash(password, 10)
  const approveToken = crypto.randomBytes(24).toString("hex")
  const request = await prisma.registrationRequest.upsert({
    where: { email },
    update: {
      passwordHash,
      displayName,
      status: "pending",
      approveToken,
      approvedAt: null,
    },
    create: {
      id: crypto.randomUUID(),
      email,
      passwordHash,
      displayName,
      approveToken,
    },
  })

  const approveUrl = new URL("/api/auth/approve-registration", req.url)
  approveUrl.searchParams.set("token", request.approveToken)

  console.log("\n[注册审核] 收到新的注册申请")
  console.log(`[注册审核] 昵称: ${request.displayName}`)
  console.log(`[注册审核] 邮箱: ${request.email}`)
  console.log(`[注册审核] 同意注册请打开: ${approveUrl.toString()}\n`)

  return NextResponse.json(
    {
      ok: true,
      status: "pending",
      message: "注册申请已提交，等待管理员审核。请稍后点击“查看审核状态”。",
    },
    { status: 202, headers: NO_STORE }
  )
}
