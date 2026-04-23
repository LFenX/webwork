import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { canDeleteManagedUser, recordActivity, requireAdminPermission } from "@/lib/admin"

export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store" }

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdminPermission("manageUsers")
    const { id } = await params

    const user = await prisma.user.findUnique({
      where: { id },
      select: { email: true, role: true, lastLoginAt: true },
    })
    if (!user) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404, headers: NO_STORE })
    }

    const blockedReason = canDeleteManagedUser(admin, {
      id,
      role: user.role,
      lastLoginAt: user.lastLoginAt,
    })
    if (blockedReason) {
      return NextResponse.json({ error: blockedReason }, { status: 400, headers: NO_STORE })
    }

    await prisma.user.delete({ where: { id } })
    await recordActivity(admin.id, "delete_user", `删除用户 ${user.email}`, req)
    return NextResponse.json({ ok: true }, { headers: NO_STORE })
  } catch {
    return NextResponse.json({ error: "无权限" }, { status: 403, headers: NO_STORE })
  }
}
