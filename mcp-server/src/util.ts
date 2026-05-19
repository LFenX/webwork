import { randomBytes } from "node:crypto"

const SLUG_FALLBACK_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789"

/**
 * Best-effort slug generator. We keep ASCII letters/digits and replace everything else
 * with `-`. If the result is empty (e.g. pure CJK title), fall back to a random suffix
 * so we never violate the unique (userId,type,slug) constraint.
 */
export function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)

  if (base) return base

  let s = ""
  for (let i = 0; i < 8; i++) {
    s += SLUG_FALLBACK_CHARS[Math.floor(Math.random() * SLUG_FALLBACK_CHARS.length)]
  }
  return `post-${s}`
}

export function withRandomSuffix(slug: string): string {
  const suffix = randomBytes(3).toString("hex")
  return `${slug.slice(0, 50)}-${suffix}`
}

export function ok<T>(data: T) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  }
}

export function fail(message: string, detail?: unknown) {
  const text =
    detail === undefined
      ? message
      : `${message}\n${JSON.stringify(detail, null, 2)}`
  return {
    isError: true,
    content: [{ type: "text" as const, text }],
  }
}

export function parseTags(stored: string | null | undefined): string[] {
  if (!stored) return []
  try {
    const parsed = JSON.parse(stored)
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : []
  } catch {
    return []
  }
}
