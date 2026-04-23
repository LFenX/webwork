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
import { publishAdminActivityChanged, publishPresenceChanged } from "@/lib/realtime-events"

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

export function canManageAI(adminOrRole: string | AdminUser) {
  if (typeof adminOrRole === "string") return adminOrRole === "owner"
  return hasAdminPermission(adminOrRole, "manageAI")
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

export function isAdminLikeRole(role: string) {
  return role === "owner" || role === "admin"
}

export function canDeleteManagedUser(
  admin: AdminUser,
  target: { id: string; role: string; lastLoginAt: Date | null },
  now = new Date()
) {
  if (target.id === admin.id) return "不能删除自己"
  if (target.role === "owner") return "终极管理员不能删除"
  if (admin.role !== "owner" && target.role === "admin") return "普通管理员不能删除其他管理员"

  const cutoff = new Date(now)
  cutoff.setDate(cutoff.getDate() - 30)
  if (!target.lastLoginAt || target.lastLoginAt > cutoff) {
    return "用户未满足 30 天未登录，暂不可删除"
  }

  return null
}

export function canUpdateManagedUserRole(
  admin: AdminUser,
  target: { id: string; role: string },
  nextRole: string
) {
  if (!["user", "admin"].includes(nextRole)) return "目标角色无效"
  if (target.role === "owner") return "终极管理员身份只能通过转让功能变更"
  if (admin.role !== "owner" && target.role === "admin") return "普通管理员不能修改其他管理员角色"
  return null
}

function buildPermissionData(permissions: AdminPermissionMap) {
  return Object.fromEntries(ADMIN_PERMISSION_DEFS.map(({ key }) => [key, permissions[key]]))
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
    manageAI: boolean | null
  }>>`
    SELECT u.id, u.email, u."displayName", u.role,
      p."approveRegistrations", p."approvePasswordChanges", p."viewActivityLogs", p."manageUsers",
      p."manageAnnouncements", p."manageStickers", p."manageUpdateLogs", p."refreshGeoLocations",
      p."manageAI"
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
      manageAI: row.manageAI ?? undefined,
    }),
  }
}

export async function normalizeUserRole(user: { id: string; email: string; displayName: string; role?: string | null }): Promise<AdminUser> {
  let role = user.role || "user"
  if (role !== "owner" && user.email.toLowerCase() === OWNER_EMAIL) {
    const existingOwner = await prisma.user.findFirst({
      where: { role: "owner" },
      select: { id: true },
    })
    if (!existingOwner || existingOwner.id === user.id) {
      role = "owner"
    }
  }
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

export async function transferOwnership(currentOwnerId: string, nextOwnerId: string) {
  if (currentOwnerId === nextOwnerId) {
    throw new Error("CANNOT_TRANSFER_TO_SELF")
  }

  return prisma.$transaction(async (tx) => {
    const [currentOwner, nextOwner] = await Promise.all([
      tx.user.findUnique({
        where: { id: currentOwnerId },
        select: { id: true, email: true, displayName: true, role: true },
      }),
      tx.user.findUnique({
        where: { id: nextOwnerId },
        select: { id: true, email: true, displayName: true, role: true },
      }),
    ])

    if (!currentOwner || currentOwner.role !== "owner") {
      throw new Error("OWNER_NOT_FOUND")
    }
    if (!nextOwner) {
      throw new Error("TARGET_NOT_FOUND")
    }
    if (nextOwner.role === "owner") {
      throw new Error("TARGET_ALREADY_OWNER")
    }

    await tx.user.update({
      where: { id: currentOwner.id },
      data: { role: "admin" },
    })
    await tx.adminPermission.upsert({
      where: { userId: currentOwner.id },
      update: {
        ...buildPermissionData(OWNER_ADMIN_PERMISSIONS),
        updatedById: currentOwner.id,
      },
      create: {
        userId: currentOwner.id,
        ...buildPermissionData(OWNER_ADMIN_PERMISSIONS),
        updatedById: currentOwner.id,
      },
    })

    await tx.user.update({
      where: { id: nextOwner.id },
      data: { role: "owner" },
    })
    await tx.adminPermission.deleteMany({ where: { userId: nextOwner.id } })

    return {
      previousOwner: currentOwner,
      nextOwner,
    }
  })
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
  if (userId && (action === "login" || action === "logout" || action === "resume_online")) {
    await publishPresenceChanged({ userId, action, detail, sessionId: sessionId ?? null })
    return
  }
  await publishAdminActivityChanged({ userId, action, detail, sessionId: sessionId ?? null })
}
