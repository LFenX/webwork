import "server-only"
import { prisma } from "@/lib/db"
import type { AccessLevel } from "@/lib/permissions"
import { normalizePublicSlug } from "@/lib/visibility"

export type CreatorProfile = {
  id: string
  email: string
  displayName: string
  bio: string
  avatarText: string
  avatarUrl: string | null
  location: string
  publicSlug: string | null
  publicRef: string
}

function withPublicRef(profile: Omit<CreatorProfile, "publicRef">): CreatorProfile {
  return { ...profile, publicRef: profile.publicSlug || profile.id }
}

export async function getCreatorProfile(userId: string): Promise<CreatorProfile | null> {
  const rows = await prisma.$queryRaw<Array<Omit<CreatorProfile, "publicRef">>>`
    SELECT id, email, "displayName", bio, "avatarText", "avatarUrl", location, "publicSlug"
    FROM "User"
    WHERE id = ${userId}
    LIMIT 1
  `
  return rows[0] ? withPublicRef(rows[0]) : null
}

export async function resolveCreatorProfileRef(ref: string): Promise<CreatorProfile | null> {
  const value = ref.trim()
  if (!value) return null
  const slug = normalizePublicSlug(value)
  const rows = await prisma.$queryRaw<Array<Omit<CreatorProfile, "publicRef">>>`
    SELECT id, email, "displayName", bio, "avatarText", "avatarUrl", location, "publicSlug"
    FROM "User"
    WHERE id = ${value} OR "publicSlug" = ${slug}
    ORDER BY CASE WHEN id = ${value} THEN 0 ELSE 1 END
    LIMIT 1
  `
  return rows[0] ? withPublicRef(rows[0]) : null
}

export function profileHref(profile: Pick<CreatorProfile, "publicRef">, suffix = "") {
  const cleanSuffix = suffix ? `/${suffix.replace(/^\/+/, "")}` : ""
  return `/u/${profile.publicRef}${cleanSuffix}`
}

export function viewerSafeProfile(profile: CreatorProfile, level: AccessLevel): CreatorProfile {
  if (level !== "public") return profile
  return { ...profile, email: "" }
}
