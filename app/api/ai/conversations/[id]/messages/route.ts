import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { listAIConversationMessages } from "@/lib/ai/service"

export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store" }

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth()
  const { id } = await params
  try {
    const items = await listAIConversationMessages(session.userId, id)
    return NextResponse.json({ items }, { headers: NO_STORE })
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE })
  }
}
