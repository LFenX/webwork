import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { deleteSession, EXPIRE_AFTER_MS, getSessionCookiePayload } from "@/lib/session"
import { presenceFromSession } from "@/lib/presence"

export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store" }

function replacedMessage(location: string, device: string) {
  const where = location || "未知地点"
  const byDevice = device ? `，设备为 ${device}` : ""
  return `你的账号已在另一台设备登录，登录地点为 ${where}${byDevice}。如果不是你本人，请及时修改密码。`
}

export async function POST(req: Request) {
  const payload = await getSessionCookiePayload()
  if (!payload) return NextResponse.json({ status: "offline" }, { status: 401, headers: NO_STORE })
  const body = await req.json().catch(() => null) as { touch?: boolean; foreground?: boolean } | null

  const session = await prisma.userSession.findUnique({
    where: { sessionId: payload.sessionId },
    select: {
      status: true,
      lastSeenAt: true,
      lastActiveAt: true,
      lastForegroundAt: true,
      replacedByLocation: true,
      replacedByDevice: true,
    },
  })

  if (!session) {
    await deleteSession()
    return NextResponse.json({ status: "offline" }, { status: 401, headers: NO_STORE })
  }

  if (session.status === "replaced") {
    await deleteSession()
    return NextResponse.json({
      status: "replaced",
      message: replacedMessage(session.replacedByLocation, session.replacedByDevice),
      replacedByLocation: session.replacedByLocation,
      replacedByDevice: session.replacedByDevice,
    }, { status: 409, headers: NO_STORE })
  }

  if (session.status !== "active") {
    await deleteSession()
    return NextResponse.json({ status: session.status === "expired" ? "expired" : "offline" }, { status: 401, headers: NO_STORE })
  }

  if (Date.now() - session.lastSeenAt.getTime() >= EXPIRE_AFTER_MS) {
    await prisma.userSession.update({
      where: { sessionId: payload.sessionId },
      data: { status: "expired" },
    }).catch(() => null)
    await deleteSession()
    return NextResponse.json({ status: "expired", message: "登录已超过 12 小时未操作，请重新登录。" }, { status: 401, headers: NO_STORE })
  }

  const now = new Date()
  const data: { lastSeenAt: Date; lastForegroundAt?: Date; lastActiveAt?: Date } = { lastSeenAt: now }
  if (body?.foreground) data.lastForegroundAt = now
  if (body?.touch) data.lastActiveAt = now

  if (body?.foreground || body?.touch || body?.foreground === false) {
    const updated = await prisma.userSession.update({
      where: { sessionId: payload.sessionId },
      data,
      select: { lastSeenAt: true, lastActiveAt: true, lastForegroundAt: true },
    })
    const status = presenceFromSession(updated, true)
    return NextResponse.json({ status }, { headers: NO_STORE })
  }

  return NextResponse.json({ status: presenceFromSession(session, true) }, { headers: NO_STORE })
}
