import "server-only"
import { redirect } from "next/navigation"
import { getSession, type SessionPayload } from "@/lib/session"

/** Returns session or redirects to /login. Use in server components / API routes that require auth. */
export async function requireAuth(): Promise<SessionPayload> {
  const session = await getSession()
  if (!session) redirect("/login")
  return session
}

/** Returns session or null. Use where auth is optional (public pages). */
export async function getOptionalSession(): Promise<SessionPayload | null> {
  return getSession()
}
