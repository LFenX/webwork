import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { hasAdminPermission, requireAdmin } from "@/lib/admin"
import { getEditableUpdateLog } from "@/lib/update-log"

export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store" }

export async function GET() {
  try {
    const admin = await requireAdmin()
    const [requests, passwordRequests, updates, totalUsers, admins, pendingRegistrations, pendingPasswordRequests] = await Promise.all([
      hasAdminPermission(admin, "approveRegistrations") ? prisma.registrationRequest.findMany({
        where: { status: "pending" },
        orderBy: { createdAt: "desc" },
        select: { id: true, email: true, displayName: true, createdAt: true, status: true },
      }) : [],
      hasAdminPermission(admin, "approvePasswordChanges") ? prisma.passwordChangeRequest.findMany({
        where: { status: "pending" },
        orderBy: { requestedAt: "desc" },
        select: {
          id: true,
          status: true,
          requestedAt: true,
          user: { select: { id: true, email: true, displayName: true } },
        },
      }) : [],
      hasAdminPermission(admin, "manageUpdateLogs") ? getEditableUpdateLog() : [],
      hasAdminPermission(admin, "manageUsers") ? prisma.user.count() : Promise.resolve(0),
      hasAdminPermission(admin, "manageUsers") ? prisma.user.count({ where: { role: { in: ["admin", "owner"] } } }) : Promise.resolve(0),
      hasAdminPermission(admin, "approveRegistrations") ? prisma.registrationRequest.count({ where: { status: "pending" } }) : Promise.resolve(0),
      hasAdminPermission(admin, "approvePasswordChanges") ? prisma.passwordChangeRequest.count({ where: { status: "pending" } }) : Promise.resolve(0),
    ])

    return NextResponse.json(
      {
        currentAdmin: admin,
        canManageUsers: hasAdminPermission(admin, "manageUsers"),
        permissions: admin.permissions,
        requests,
        passwordRequests,
        updates,
        counts: {
          totalUsers,
          admins,
          pendingRegistrations,
          pendingPasswordRequests,
        },
      },
      { headers: NO_STORE }
    )
  } catch {
    return NextResponse.json({ error: "无权限" }, { status: 403, headers: NO_STORE })
  }
}
