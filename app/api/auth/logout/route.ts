import { NextResponse } from "next/server"
import { deleteSession, getSessionCookiePayload, markSessionLoggedOut } from "@/lib/session"

export const dynamic = "force-dynamic"

const NO_STORE = { "Cache-Control": "no-store" }

function getPublicUrl(req: Request, pathname: string) {
  const forwardedHost = req.headers.get("x-forwarded-host")
  const forwardedProto = req.headers.get("x-forwarded-proto") ?? "https"
  if (forwardedHost) return new URL(pathname, `${forwardedProto}://${forwardedHost}`)
  return new URL(pathname, req.url)
}

export async function GET(req: Request) {
  const session = await getSessionCookiePayload()
  if (session) await markSessionLoggedOut(session.sessionId, req)
  await deleteSession()
  const url = getPublicUrl(req, "/login")
  const response = NextResponse.redirect(url, { headers: NO_STORE })
  response.cookies.delete("session")
  return response
}

export async function POST(req: Request) {
  const session = await getSessionCookiePayload()
  if (session) await markSessionLoggedOut(session.sessionId, req)
  await deleteSession()
  const response = NextResponse.json({ ok: true }, { headers: NO_STORE })
  response.cookies.delete("session")
  return response
}
