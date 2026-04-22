import "server-only"
import crypto from "node:crypto"
import { SignJWT, jwtVerify } from "jose"
import { cookies } from "next/headers"
import { prisma } from "@/lib/db"
import { getRequestMeta } from "@/lib/request-meta"

const COOKIE_NAME = "session"
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7 // 7 days
export const AWAY_AFTER_MS = 30 * 60 * 1000
export const EXPIRE_AFTER_MS = 12 * 60 * 60 * 1000

function getKey() {
  const secret = process.env.SESSION_SECRET
  if (!secret) throw new Error("SESSION_SECRET env var is not set")
  return new TextEncoder().encode(secret)
}

export interface SessionPayload {
  userId: string
  email: string
  sessionId: string
}

export async function createSession(payload: SessionPayload): Promise<void> {
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getKey())

  const jar = await cookies()
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  })
}

export async function getSessionCookiePayload(): Promise<SessionPayload | null> {
  const jar = await cookies()
  const token = jar.get(COOKIE_NAME)?.value
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, getKey(), { algorithms: ["HS256"] })
    const userId = payload.userId as string | undefined
    const email = payload.email as string | undefined
    const sessionId = payload.sessionId as string | undefined
    if (!userId || !email || !sessionId) return null
    return { userId, email, sessionId }
  } catch {
    return null
  }
}

export async function getSession(): Promise<SessionPayload | null> {
  const payload = await getSessionCookiePayload()
  if (!payload) return null

  const session = await prisma.userSession.findUnique({
    where: { sessionId: payload.sessionId },
    select: { status: true, lastSeenAt: true },
  })
  if (!session || session.status !== "active") return null

  if (Date.now() - session.lastSeenAt.getTime() >= EXPIRE_AFTER_MS) {
    await prisma.userSession.update({
      where: { sessionId: payload.sessionId },
      data: { status: "expired" },
    }).catch(() => null)
    return null
  }

  return payload
}

export async function startUserSession({
  userId,
  email,
  req,
}: {
  userId: string
  email: string
  req?: { headers: Headers }
}): Promise<SessionPayload> {
  const now = new Date()
  const expiresAt = new Date(now.getTime() + COOKIE_MAX_AGE * 1000)
  const sessionId = crypto.randomUUID()
  const meta = await getRequestMeta(req)

  await prisma.$transaction([
    prisma.userSession.updateMany({
      where: { userId, status: "active" },
      data: {
        status: "replaced",
        replacedByLocation: meta.geoLocation,
        replacedByDevice: meta.deviceInfo,
      },
    }),
    prisma.userSession.create({
      data: {
        sessionId,
        user: { connect: { id: userId } },
        status: "active",
        ipAddress: meta.ipAddress,
        geoLocation: meta.geoLocation,
        deviceInfo: meta.deviceInfo,
        lastSeenAt: now,
        expiresAt,
      },
    }),
  ])

  const payload = { userId, email, sessionId }
  await createSession(payload)
  return payload
}

export async function markSessionLoggedOut(sessionId: string): Promise<void> {
  await prisma.userSession.update({
    where: { sessionId },
    data: { status: "logged_out" },
  }).catch(() => null)
}

export async function deleteSession(): Promise<void> {
  const jar = await cookies()
  jar.delete(COOKIE_NAME)
}
