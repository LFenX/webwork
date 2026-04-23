import "server-only"
import { prisma } from "@/lib/db"
import { getSession } from "@/lib/session"
import { getRequestMeta } from "@/lib/request-meta"
import {
  ADMIN_PERMISSION_DEFS,
  EMPTY_ADMIN_PERMISSIONS,
  OWNER_ADMIN_PERMISSIONS,
  type AdminPermissionKey,
  type AdminPermissionMap,
  normalizeAdminPermissions,
} from "@/lib/admin-permissions"

export const OWNER_EMAIL = "fli.gda@foxmail.com"
export { ADMIN_PERMISSION_DEFS }

export type AdminUser = {
  id: string
  email: string
  displayName: string
  role: string
  permissions: AdminPermissionMap
}

export function canApproveRegistrations(adminOrRole: string | AdminUser) {
  if (typeof adminOrRole === "string") return adminOrRole === "owner"
  return hasAdminPermission(adminOrRole, "approveRegistrations")
}

export function canManageUsers(adminOrRole: string | AdminUser) {
  if (typeof adminOrRole === "string") return adminOrRole === "owner"
  return hasAdminPermission(adminOrRole, "manageUsers")
}

function permissionsForRole(role: string, stored?: Partial<AdminPermissionMap> | null): AdminPermissionMap {
  if (role === "owner") return OWNER_ADMIN_PERMISSIONS
  if (role !== "admin") return EMPTY_ADMIN_PERMISSIONS
  return normalizeAdminPermissions(stored)
}

export function hasAdminPermission(admin: AdminUser, permission: AdminPermissionKey) {
  if (admin.role === "owner") return true
  return Boolean(admin.permissions[permission])
}

export async function getUserAdminInfo(userId: string): Promise<AdminUser | null> {
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
    WHERE u.id = ${userId}
    LIMIT 1
  `
  const row = rows[0]
  if (!row) return null
  return {
    id: row.id,
    email: row.email,
    displayName: row.displayName,
    role: row.role,
    permissions: permissionsForRole(row.role, {
      approveRegistrations: row.approveRegistrations ?? undefined,
      approvePasswordChanges: row.approvePasswordChanges ?? undefined,
      viewActivityLogs: row.viewActivityLogs ?? undefined,
      manageUsers: row.manageUsers ?? undefined,
      manageAnnouncements: row.manageAnnouncements ?? undefined,
      manageStickers: row.manageStickers ?? undefined,
      manageUpdateLogs: row.manageUpdateLogs ?? undefined,
      refreshGeoLocations: row.refreshGeoLocations ?? undefined,
    }),
  }
}

export async function normalizeUserRole(user: { id: string; email: string; displayName: string; role?: string | null }): Promise<AdminUser> {
  const role = user.email.toLowerCase() === OWNER_EMAIL ? "owner" : user.role || "user"
  if (role !== user.role) {
    await prisma.$executeRaw`
      UPDATE "User"
      SET role = ${role}
      WHERE id = ${user.id}
    `
  }
  const fullUser = await getUserAdminInfo(user.id)
  return fullUser ?? { id: user.id, email: user.email, displayName: user.displayName, role, permissions: permissionsForRole(role) }
}

export async function getCurrentAdmin() {
  const session = await getSession()
  if (!session) return null

  const user = await getUserAdminInfo(session.userId)
  if (!user) return null
  const normalized = await normalizeUserRole(user)
  return normalized.role === "owner" || normalized.role === "admin" ? normalized : null
}

export async function requireAdmin() {
  const admin = await getCurrentAdmin()
  if (!admin) throw new Error("FORBIDDEN")
  return admin
}

export async function requireAdminPermission(permission: AdminPermissionKey) {
  const admin = await requireAdmin()
  if (!hasAdminPermission(admin, permission)) throw new Error("FORBIDDEN")
  return admin
}

export async function recordActivity(userId: string | null, action: string, detail = "", req?: { headers: Headers }, sessionId?: string | null) {
  const meta = await getRequestMeta(req)
  await prisma.userActivity.create({
    data: {
      action,
      detail,
      sessionId: sessionId ?? undefined,
      ipAddress: meta.ipAddress,
      geoLocation: meta.geoLocation,
      deviceInfo: meta.deviceInfo,
      createdAt: new Date(),
      ...(userId ? { user: { connect: { id: userId } } } : {}),
    },
  })
}
