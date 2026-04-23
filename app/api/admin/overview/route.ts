import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { hasAdminPermission, requireAdmin } from "@/lib/admin"
import { getEditableUpdateLog } from "@/lib/update-log"

export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store" }

export async function GET() {
  try {
    const admin = await requireAdmin()
    const [requests, passwordRequests, updates] = await Promise.all([
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
    ])

    return NextResponse.json(
      {
        currentAdmin: admin,
        canManageUsers: hasAdminPermission(admin, "manageUsers"),
        permissions: admin.permissions,
        requests,
        passwordRequests,
        updates,
      },
      { headers: NO_STORE }
    )
  } catch {
    return NextResponse.json({ error: "无权限" }, { status: 403, headers: NO_STORE })
  }
}
