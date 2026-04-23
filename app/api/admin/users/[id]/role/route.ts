import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { OWNER_EMAIL, recordActivity, requireAdminPermission } from "@/lib/admin"

export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store" }

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdminPermission("manageUsers")

    const { id } = await params
    const body = await req.json().catch(() => null)
    const role = body?.role === "admin" ? "admin" : "user"
    const target = await prisma.user.findUnique({ where: { id }, select: { email: true, displayName: true } })
    if (!target) return NextResponse.json({ error: "用户不存在" }, { status: 404, headers: NO_STORE })
    if (target.email.toLowerCase() === OWNER_EMAIL) {
      return NextResponse.json({ error: "终极管理员权限不能修改" }, { status: 400, headers: NO_STORE })
    }

    await prisma.$executeRaw`
      UPDATE "User"
      SET role = ${role}
      WHERE id = ${id}
    `
    if (role !== "admin") {
      await prisma.adminPermission.deleteMany({ where: { userId: id } })
    }
    const user = { id, email: target.email, displayName: target.displayName, role }
    await recordActivity(admin.id, "update_user_role", `设置 ${user.email} 为 ${role}`, req)
    return NextResponse.json(user, { headers: NO_STORE })
  } catch {
    return NextResponse.json({ error: "无权限" }, { status: 403, headers: NO_STORE })
  }
}
