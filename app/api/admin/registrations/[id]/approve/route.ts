import { NextRequest, NextResponse } from "next/server"
import crypto from "node:crypto"
import { prisma } from "@/lib/db"
import { recordActivity, requireAdminPermission } from "@/lib/admin"

export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store" }

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdminPermission("approveRegistrations")
    const { id } = await params
    const request = await prisma.registrationRequest.findUnique({ where: { id } })
    if (!request) return NextResponse.json({ error: "申请不存在" }, { status: 404, headers: NO_STORE })

    let user = await prisma.user.findUnique({ where: { email: request.email } })
    if (!user) {
      user = await prisma.user.create({
        data: {
          id: crypto.randomUUID(),
          email: request.email,
          passwordHash: request.passwordHash,
          displayName: request.displayName,
        },
      })
    }

    await prisma.registrationRequest.update({
      where: { id },
      data: { status: "approved", approvedAt: new Date() },
    })
    await recordActivity(admin.id, "approve_registration", `同意 ${request.email} 注册`, req)

    return NextResponse.json({ ok: true, user }, { headers: NO_STORE })
  } catch {
    return NextResponse.json({ error: "无权限" }, { status: 403, headers: NO_STORE })
  }
}
