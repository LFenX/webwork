import { prisma } from "./prisma.js"

let cached: { id: string; email: string; displayName: string } | null = null

/**
 * Resolve the user this MCP server acts on behalf of.
 *
 * Priority:
 *   1. BLOG_USER_ID  (cuid)
 *   2. BLOG_USER_EMAIL (looked up in the User table)
 *
 * Resolves once at startup and caches.
 */
export async function getCurrentUser() {
  if (cached) return cached

  const id = process.env.BLOG_USER_ID?.trim()
  const email = process.env.BLOG_USER_EMAIL?.trim().toLowerCase()

  if (!id && !email) {
    throw new Error(
      "[mcp-server] BLOG_USER_ID or BLOG_USER_EMAIL must be set in the env block of ~/.hermes/config.yaml.",
    )
  }

  const user = await prisma.user.findFirst({
    where: id ? { id } : { email },
    select: { id: true, email: true, displayName: true },
  })

  if (!user) {
    throw new Error(
      `[mcp-server] User not found (looked up by ${id ? `id=${id}` : `email=${email}`}). ` +
        "Verify the account exists in the lgplayblog database.",
    )
  }

  cached = user
  return user
}
