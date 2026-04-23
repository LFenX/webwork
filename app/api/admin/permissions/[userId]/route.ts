import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { recordActivity, requireAdmin } from "@/lib/admin"
import { ADMIN_PERMISSION_DEFS, normalizeAdminPermissions } from "@/lib/admin-permissions"
import { publishAdminPermissionsChanged } from "@/lib/realtime-events"

export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store" }

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const admin = await requireAdmin()
    if (admin.role !== "owner") {
      return NextResponse.json({ error: "只有终极管理员可以配置管理员权限" }, { status: 403, headers: NO_STORE })
    }

    const { userId } = await params
    const target = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, role: true } })
    if (!target) return NextResponse.json({ error: "管理员不存在" }, { status: 404, headers: NO_STORE })
    if (target.role !== "admin") return NextResponse.json({ error: "只能配置普通管理员权限" }, { status: 400, headers: NO_STORE })

    const body = await req.json().catch(() => null)
    const requested = normalizeAdminPermissions(body?.permissions)
    const data = Object.fromEntries(ADMIN_PERMISSION_DEFS.map(({ key }) => [key, requested[key]]))
    const permission = await prisma.adminPermission.upsert({
      where: { userId },
      update: { ...data, updatedById: admin.id },
      create: { userId, ...data, updatedById: admin.id },
    })

    await recordActivity(admin.id, "update_admin_permissions", `更新 ${target.email} 的管理员权限`, req)
    await publishAdminPermissionsChanged(target.id)
    return NextResponse.json({
      id: target.id,
      email: target.email,
      role: target.role,
      permissions: normalizeAdminPermissions(permission),
    }, { headers: NO_STORE })
  } catch {
    return NextResponse.json({ error: "无权限" }, { status: 403, headers: NO_STORE })
  }
}
