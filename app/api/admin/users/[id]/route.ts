import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { OWNER_EMAIL, canManageUsers, recordActivity, requireAdmin } from "@/lib/admin"

export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store" }

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin()
    if (!canManageUsers(admin.role)) {
      return NextResponse.json({ error: "普通管理员不能删除用户" }, { status: 403, headers: NO_STORE })
    }

    const { id } = await params
    if (id === admin.id) {
      return NextResponse.json({ error: "不能删除当前登录用户" }, { status: 400, headers: NO_STORE })
    }

    const rows = await prisma.$queryRaw<Array<{ email: string; lastLoginAt: Date | null }>>`
      SELECT email, "lastLoginAt"
      FROM "User"
      WHERE id = ${id}
      LIMIT 1
    `
    const user = rows[0] ?? null
    if (!user) return NextResponse.json({ error: "用户不存在" }, { status: 404, headers: NO_STORE })
    if (user.email.toLowerCase() === OWNER_EMAIL) {
      return NextResponse.json({ error: "不能删除终极管理员" }, { status: 400, headers: NO_STORE })
    }

    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 30)
    if (!user.lastLoginAt || user.lastLoginAt > cutoff) {
      return NextResponse.json({ error: "用户未满足 30 天未登录，删除失败" }, { status: 400, headers: NO_STORE })
    }

    await prisma.user.delete({ where: { id } })
    await recordActivity(admin.id, "delete_user", `删除用户 ${user.email}`, req)
    return NextResponse.json({ ok: true }, { headers: NO_STORE })
  } catch {
    return NextResponse.json({ error: "无权限" }, { status: 403, headers: NO_STORE })
  }
}
