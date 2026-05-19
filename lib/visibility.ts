export const VISIBILITY_LEVELS = ["private", "friends", "public"] as const

export type Visibility = (typeof VISIBILITY_LEVELS)[number]

export const PUBLIC_USER_SLUG_REGEX = /^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])?$/

export const RESERVED_PUBLIC_USER_SLUGS = new Set([
  "admin",
  "ai",
  "api",
  "blog",
  "channels",
  "community",
  "daily",
  "edit",
  "friends",
  "interviews",
  "jobs",
  "login",
  "new",
  "notes",
  "reflections",
  "register",
  "resume",
  "settings",
  "sql",
  "sql-practice",
  "stickers",
  "updates",
  "uploads",
  "u",
])

export function isVisibility(value: unknown): value is Visibility {
  return typeof value === "string" && VISIBILITY_LEVELS.includes(value as Visibility)
}

export function normalizeVisibility(value: unknown): Visibility {
  return isVisibility(value) ? value : "private"
}

export function normalizePublicSlug(value: string) {
  return value.trim().toLowerCase()
}

export function validatePublicSlug(value: string) {
  const slug = normalizePublicSlug(value)
  if (!slug) return { ok: true as const, slug: null }
  if (!PUBLIC_USER_SLUG_REGEX.test(slug)) {
    return {
      ok: false as const,
      slug,
      reason: "Public slug must be 3-32 lowercase letters, numbers, or hyphens.",
    }
  }
  if (RESERVED_PUBLIC_USER_SLUGS.has(slug)) {
    return { ok: false as const, slug, reason: "This public slug is reserved." }
  }
  return { ok: true as const, slug }
}
