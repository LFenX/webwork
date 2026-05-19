import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { jsonError } from "@/lib/sql-lab/service"
import { createSqlThread, listSqlThreads } from "@/lib/sql-lab/threads"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const NO_STORE = { "Cache-Control": "no-store" } as const

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth()
    const archived = req.nextUrl.searchParams.get("archived") === "1"
    const items = await listSqlThreads(session.userId, { archived })
    return NextResponse.json({ items }, { headers: NO_STORE })
  } catch (error) {
    return jsonError(error)
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth()
    const body = await req.json().catch(() => ({})) as { title?: string; prompt?: string; modelName?: string }
    const thread = await createSqlThread(session.userId, body)
    return NextResponse.json(thread, { headers: NO_STORE })
  } catch (error) {
    return jsonError(error)
  }
}
