import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { listMemoryEvents } from "@/lib/ai/memory/memory-service"

export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store" }

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "未登录" }, { status: 401, headers: NO_STORE })

  const { searchParams } = req.nextUrl
  const limit = searchParams.get("limit") ? Number(searchParams.get("limit")) : 20

  const result = await listMemoryEvents(session.userId, {
    limit: Math.min(Math.max(limit, 1), 50),
  })

  const items = (result.items as Array<Record<string, unknown>>).map((item) => ({
    id: item.id,
    conversationId: item.conversationId,
    topicSummary: item.topicSummary,
    keyTakeaways: item.keyTakeaways,
    relatedModules: item.relatedModules,
    keywords: item.keywords,
    importance: item.importance,
    sensitive: item.sensitive,
    createdAt: item.createdAt,
  }))

  return NextResponse.json({ items, total: result.total }, { headers: NO_STORE })
}
