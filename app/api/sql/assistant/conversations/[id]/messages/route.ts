import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { getSqlAssistantMessages } from "@/lib/sql-lab/assistant-history"
import { jsonError } from "@/lib/sql-lab/service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const NO_STORE = { "Cache-Control": "no-store" } as const

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth()
    const { id } = await params
    const messages = await getSqlAssistantMessages(session.userId, id)
    return NextResponse.json({ messages }, { headers: NO_STORE })
  } catch (error) {
    return jsonError(error)
  }
}
