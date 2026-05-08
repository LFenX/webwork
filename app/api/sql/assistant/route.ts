import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { sendSqlAssistantMessage } from "@/lib/sql-lab/assistant-history"
import { jsonError } from "@/lib/sql-lab/service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const NO_STORE = { "Cache-Control": "no-store" } as const

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth()
    const body = await req.json().catch(() => ({}))
    const result = await sendSqlAssistantMessage(session.userId, body)
    return NextResponse.json(result, { headers: NO_STORE })
  } catch (error) {
    return jsonError(error)
  }
}
