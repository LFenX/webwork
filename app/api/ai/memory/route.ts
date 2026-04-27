import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { createMemoryFactSchema } from "@/lib/validators"
import { saveMemoryFact, listMemoryFacts } from "@/lib/ai/memory/memory-service"

export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store" }

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "未登录" }, { status: 401, headers: NO_STORE })

  const { searchParams } = req.nextUrl
  const category = searchParams.get("category") || undefined
  const keyword = searchParams.get("keyword") || undefined
  const limit = searchParams.get("limit") ? Number(searchParams.get("limit")) : 20

  // listMemoryFacts supports category and offset but not keyword directly
  // For keyword search, we fetch all and filter; for no keyword, use standard list
  const result = await listMemoryFacts(session.userId, {
    category,
    limit: Math.min(Math.max(limit, 1), 50),
  })

  let items = result.items
  if (keyword) {
    const kw = keyword.toLowerCase()
    items = (items as Array<Record<string, unknown>>).filter(
      (item) =>
        (typeof item.title === "string" && item.title.toLowerCase().includes(kw)) ||
        (typeof item.content === "string" && item.content.toLowerCase().includes(kw)) ||
        (Array.isArray(item.tags) && item.tags.some((t: unknown) => typeof t === "string" && t.toLowerCase().includes(kw))),
    )
  }

  const responseItems = (items as Array<Record<string, unknown>>).map((item) => ({
    id: item.id,
    category: item.category,
    title: item.title,
    content: typeof item.content === "string" ? item.content.slice(0, 200) : "",
    tags: item.tags,
    source: item.source,
    importance: item.importance,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  }))

  return NextResponse.json({ items: responseItems, total: result.total }, { headers: NO_STORE })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "未登录" }, { status: 401, headers: NO_STORE })

  const body = await req.json().catch(() => null)
  const parsed = createMemoryFactSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "参数错误", detail: parsed.error.flatten() }, { status: 400, headers: NO_STORE })
  }

  const result = await saveMemoryFact(session.userId, {
    ...parsed.data,
    source: "manual",
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.reason ?? "保存失败" }, { status: 400, headers: NO_STORE })
  }

  return NextResponse.json({ id: result.id, ok: true }, { status: 201, headers: NO_STORE })
}
