import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import {
  deleteSqlAssistantConversation,
  renameSqlAssistantConversation,
} from "@/lib/sql-lab/assistant-history"
import { jsonError } from "@/lib/sql-lab/service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const NO_STORE = { "Cache-Control": "no-store" } as const

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth()
    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const conversation = await renameSqlAssistantConversation(
      session.userId,
      id,
      typeof body.title === "string" ? body.title : ""
    )
    return NextResponse.json({ conversation }, { headers: NO_STORE })
  } catch (error) {
    return jsonError(error)
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth()
    const { id } = await params
    await deleteSqlAssistantConversation(session.userId, id)
    return new NextResponse(null, { status: 204, headers: NO_STORE })
  } catch (error) {
    return jsonError(error)
  }
}
