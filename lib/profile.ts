import "server-only"
import { prisma } from "@/lib/db"

export type CreatorProfile = {
  id: string
  email: string
  displayName: string
  bio: string
  avatarText: string
  avatarUrl: string | null
  location: string
}

export async function getCreatorProfile(userId: string): Promise<CreatorProfile | null> {
  const rows = await prisma.$queryRaw<CreatorProfile[]>`
    SELECT id, email, "displayName", bio, "avatarText", "avatarUrl", location
    FROM "User"
    WHERE id = ${userId}
    LIMIT 1
  `
  return rows[0] ?? null
}
