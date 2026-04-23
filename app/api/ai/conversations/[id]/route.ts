import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { deleteAIConversation, updateAIConversation } from "@/lib/ai/service"
import { aiConversationUpdateSchema } from "@/lib/validators"

export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store" }

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth()
  const { id } = await params
  const body = await req.json().catch(() => null)
  const parsed = aiConversationUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400, headers: NO_STORE })
  }
  try {
    const conversation = await updateAIConversation(session.userId, id, parsed.data)
    return NextResponse.json({
      id: conversation.id,
      title: conversation.title,
      updatedAt: conversation.updatedAt.toISOString(),
    }, { headers: NO_STORE })
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth()
  const { id } = await params
  try {
    await deleteAIConversation(session.userId, id)
    return NextResponse.json({ success: true }, { headers: NO_STORE })
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE })
  }
}
