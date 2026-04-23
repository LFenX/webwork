import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/db"

export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store" }

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "未登录" }, { status: 401, headers: NO_STORE })
  const limit = Math.min(Math.max(Number(req.nextUrl.searchParams.get("limit") ?? 100), 1), 100)
  const items = await prisma.worldBroadcast.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { author: { select: { id: true, email: true, displayName: true } } },
  })
  return NextResponse.json({
    items: items.map((item) => ({
      id: item.id,
      content: item.content,
      createdAt: item.createdAt.toISOString(),
      author: item.author,
    })),
  }, { headers: NO_STORE })
}
