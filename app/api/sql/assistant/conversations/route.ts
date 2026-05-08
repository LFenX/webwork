import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import {
  createSqlAssistantConversation,
  listSqlAssistantConversations,
} from "@/lib/sql-lab/assistant-history"
import { jsonError } from "@/lib/sql-lab/service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const NO_STORE = { "Cache-Control": "no-store" } as const

export async function GET() {
  try {
    const session = await requireAuth()
    const conversations = await listSqlAssistantConversations(session.userId)
    return NextResponse.json({ conversations }, { headers: NO_STORE })
  } catch (error) {
    return jsonError(error)
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth()
    const body = await req.json().catch(() => ({}))
    const conversation = await createSqlAssistantConversation(
      session.userId,
      typeof body.title === "string" ? body.title : undefined
    )
    return NextResponse.json({ conversation }, { headers: NO_STORE })
  } catch (error) {
    return jsonError(error)
  }
}
