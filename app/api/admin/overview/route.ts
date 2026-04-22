import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { canManageUsers, requireAdmin } from "@/lib/admin"

export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store" }

export async function GET() {
  try {
    const admin = await requireAdmin()
    const [requests, passwordRequests, users, activities] = await Promise.all([
      prisma.registrationRequest.findMany({
        where: { status: "pending" },
        orderBy: { createdAt: "desc" },
        select: { id: true, email: true, displayName: true, createdAt: true, status: true },
      }),
      prisma.passwordChangeRequest.findMany({
        where: { status: "pending" },
        orderBy: { requestedAt: "desc" },
        select: {
          id: true,
          status: true,
          requestedAt: true,
          user: { select: { id: true, email: true, displayName: true } },
        },
      }),
      prisma.$queryRaw<Array<{ id: string; email: string; displayName: string; role: string; lastLoginAt: Date | null; createdAt: Date }>>`
        SELECT id, email, displayName, role, lastLoginAt, createdAt
        FROM User
        ORDER BY createdAt DESC
      `,
      prisma.$queryRaw<Array<{ id: string; action: string; detail: string; createdAt: Date; user: null; userEmail: string | null; userDisplayName: string | null }>>`
        SELECT a.id, a.action, a.detail, a.createdAt, u.email AS userEmail, u.displayName AS userDisplayName
        FROM UserActivity a
        LEFT JOIN User u ON u.id = a.userId
        ORDER BY a.createdAt DESC
        LIMIT 80
      `.then((rows) => rows.map((row) => ({
        id: row.id,
        action: row.action,
        detail: row.detail,
        createdAt: row.createdAt,
        user: row.userEmail ? { email: row.userEmail, displayName: row.userDisplayName ?? "" } : null,
      }))),
    ])

    return NextResponse.json(
      {
        currentAdmin: admin,
        canManageUsers: canManageUsers(admin.role),
        requests,
        passwordRequests,
        users,
        activities,
      },
      { headers: NO_STORE }
    )
  } catch {
    return NextResponse.json({ error: "无权限" }, { status: 403, headers: NO_STORE })
  }
}
