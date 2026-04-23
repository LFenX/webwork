import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { requireAdmin } from "@/lib/admin"
import { normalizeAdminPermissions } from "@/lib/admin-permissions"

export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store" }

export async function GET() {
  try {
    const admin = await requireAdmin()
    if (admin.role !== "owner") {
      return NextResponse.json({ error: "无权限" }, { status: 403, headers: NO_STORE })
    }

    const rows = await prisma.$queryRaw<Array<{
      id: string
      email: string
      displayName: string
      role: string
      approveRegistrations: boolean | null
      approvePasswordChanges: boolean | null
      viewActivityLogs: boolean | null
      manageUsers: boolean | null
      manageAnnouncements: boolean | null
      manageStickers: boolean | null
      manageUpdateLogs: boolean | null
      refreshGeoLocations: boolean | null
    }>>`
      SELECT u.id, u.email, u."displayName", u.role,
        p."approveRegistrations", p."approvePasswordChanges", p."viewActivityLogs", p."manageUsers",
        p."manageAnnouncements", p."manageStickers", p."manageUpdateLogs", p."refreshGeoLocations"
      FROM "User" u
      LEFT JOIN "AdminPermission" p ON p."userId" = u.id
      WHERE u.role = 'admin'
      ORDER BY u."createdAt" DESC
    `

    return NextResponse.json({
      items: rows.map((row) => ({
        id: row.id,
        email: row.email,
        displayName: row.displayName,
        role: row.role,
        permissions: normalizeAdminPermissions(row),
      })),
    }, { headers: NO_STORE })
  } catch {
    return NextResponse.json({ error: "无权限" }, { status: 403, headers: NO_STORE })
  }
}
