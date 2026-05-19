const DEFAULT_SITE_URL = "http://localhost:3000"

export function absoluteSiteUrl(path: string) {
  const base = process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL
  return new URL(path, base).toString()
}
