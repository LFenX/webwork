import { NextRequest, NextResponse } from "next/server"
import crypto from "node:crypto"
import { prisma } from "@/lib/db"
import { recordActivity, requireAdmin } from "@/lib/admin"

export const dynamic = "force-dynamic"

const NO_STORE = { "Cache-Control": "no-store" }

export async function GET(req: NextRequest) {
  let admin
  try {
    admin = await requireAdmin()
  } catch {
    return NextResponse.json({ error: "无权限" }, { status: 403, headers: NO_STORE })
  }

  const token = req.nextUrl.searchParams.get("token") ?? ""
  if (!token) {
    return NextResponse.json({ error: "缺少审核 token" }, { status: 400, headers: NO_STORE })
  }

  const request = await prisma.registrationRequest.findUnique({ where: { approveToken: token } })
  if (!request) {
    return NextResponse.json({ error: "注册申请不存在或 token 无效" }, { status: 404, headers: NO_STORE })
  }

  if (request.status === "approved") {
    return new NextResponse("该注册申请已经通过，可以让用户登录。", {
      status: 200,
      headers: { ...NO_STORE, "Content-Type": "text/plain; charset=utf-8" },
    })
  }

  const existing = await prisma.user.findUnique({ where: { email: request.email } })
  if (!existing) {
    await prisma.user.create({
      data: {
        id: crypto.randomUUID(),
        email: request.email,
        passwordHash: request.passwordHash,
        displayName: request.displayName,
      },
    })
  }

  await prisma.registrationRequest.update({
    where: { id: request.id },
    data: { status: "approved", approvedAt: new Date() },
  })
  await recordActivity(admin.id, "approve_registration", `同意 ${request.email} 注册`, req)

  console.log(`[注册审核] 已通过: ${request.email}`)

  return new NextResponse(`已通过 ${request.email} 的注册申请。用户现在可以登录。`, {
    status: 200,
    headers: { ...NO_STORE, "Content-Type": "text/plain; charset=utf-8" },
  })
}
