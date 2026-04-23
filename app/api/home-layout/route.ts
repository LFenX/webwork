import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { DEFAULT_HOME_LAYOUT, normalizeHomeLayout } from "@/lib/home-layout"
import { publishUserPageChanged } from "@/lib/realtime-events"
import { getSession } from "@/lib/session"

export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store" }

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "未登录" }, { status: 401, headers: NO_STORE })
  const row = await prisma.homeLayout.findUnique({ where: { userId: session.userId } })
  return NextResponse.json({ items: normalizeHomeLayout(row?.config) }, { headers: NO_STORE })
}

export async function PATCH(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "未登录" }, { status: 401, headers: NO_STORE })
  const body = await req.json().catch(() => null)
  const items = normalizeHomeLayout(body?.items)
  await prisma.homeLayout.upsert({
    where: { userId: session.userId },
    create: { userId: session.userId, config: items },
    update: { config: items },
  })
  await publishUserPageChanged(session.userId, "home-layout")
  return NextResponse.json({ items }, { headers: NO_STORE })
}

export async function DELETE() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "未登录" }, { status: 401, headers: NO_STORE })
  await prisma.homeLayout.delete({ where: { userId: session.userId } }).catch(() => null)
  await publishUserPageChanged(session.userId, "home-layout")
  return NextResponse.json({ items: DEFAULT_HOME_LAYOUT }, { headers: NO_STORE })
}
