import "server-only"
import { prisma } from "@/lib/db"
import { getSession } from "@/lib/session"

export type SqlPracticeAccess = {
  userId: string
  role: string
  isOwner: boolean
  canAccess: boolean
  grantEnabled: boolean
}

async function loadUserAccess(userId: string): Promise<SqlPracticeAccess | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true },
  })
  if (!user) return null
  const isOwner = user.role === "owner"
  let grantEnabled = false
  if (!isOwner) {
    const grant = await prisma.sqlPracticeAccessGrant.findUnique({
      where: { userId: user.id },
      select: { enabled: true },
    })
    grantEnabled = Boolean(grant?.enabled)
  }
  return {
    userId: user.id,
    role: user.role,
    isOwner,
    canAccess: isOwner || grantEnabled,
    grantEnabled,
  }
}

export async function getSqlPracticeAccess(): Promise<SqlPracticeAccess | null> {
  const session = await getSession()
  if (!session) return null
  return loadUserAccess(session.userId)
}

export async function requireSqlPracticeAccess(): Promise<SqlPracticeAccess> {
  const access = await getSqlPracticeAccess()
  if (!access || !access.canAccess) throw new Error("FORBIDDEN")
  return access
}

export async function requireSqlPracticeOwner(): Promise<SqlPracticeAccess> {
  const access = await getSqlPracticeAccess()
  if (!access || !access.isOwner) throw new Error("FORBIDDEN")
  return access
}
