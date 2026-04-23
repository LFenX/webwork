import { NextResponse } from "next/server"
import { getAnnouncementFeed } from "@/lib/announcement-feed"
import { getSession } from "@/lib/session"

export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store" }

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "未登录" }, { status: 401, headers: NO_STORE })
  const items = await getAnnouncementFeed(session.userId, 50)
  return NextResponse.json({ items }, { headers: NO_STORE })
}
