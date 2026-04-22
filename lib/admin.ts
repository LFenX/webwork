import "server-only"
import { prisma } from "@/lib/db"
import { getSession } from "@/lib/session"
import { getRequestMeta } from "@/lib/request-meta"

export const OWNER_EMAIL = "fli.gda@foxmail.com"

export type AdminUser = {
  id: string
  email: string
  displayName: string
  role: string
}

export function canApproveRegistrations(role: string) {
  return role === "owner" || role === "admin"
}

export function canManageUsers(role: string) {
  return role === "owner"
}

export async function getUserAdminInfo(userId: string): Promise<AdminUser | null> {
  const rows = await prisma.$queryRaw<AdminUser[]>`
    SELECT id, email, displayName, role
    FROM User
    WHERE id = ${userId}
    LIMIT 1
  `
  return rows[0] ?? null
}

export async function normalizeUserRole(user: { id: string; email: string; displayName: string; role?: string | null }): Promise<AdminUser> {
  const role = user.email.toLowerCase() === OWNER_EMAIL ? "owner" : user.role || "user"
  if (role !== user.role) {
    await prisma.$executeRaw`
      UPDATE User
      SET role = ${role}
      WHERE id = ${user.id}
    `
  }
  return { id: user.id, email: user.email, displayName: user.displayName, role }
}

export async function getCurrentAdmin() {
  const session = await getSession()
  if (!session) return null

  const user = await getUserAdminInfo(session.userId)
  if (!user) return null
  const normalized = await normalizeUserRole(user)
  return canApproveRegistrations(normalized.role) ? normalized : null
}

export async function requireAdmin() {
  const admin = await getCurrentAdmin()
  if (!admin) throw new Error("FORBIDDEN")
  return admin
}

export async function recordActivity(userId: string | null, action: string, detail = "", req?: { headers: Headers }) {
  const meta = await getRequestMeta(req)
  await prisma.userActivity.create({
    data: {
      action,
      detail,
      ipAddress: meta.ipAddress,
      geoLocation: meta.geoLocation,
      deviceInfo: meta.deviceInfo,
      createdAt: new Date(),
      ...(userId ? { user: { connect: { id: userId } } } : {}),
    },
  })
}
