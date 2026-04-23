import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { createAIConversation, listAIConversations } from "@/lib/ai/service"
import { aiConversationCreateSchema } from "@/lib/validators"

export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store" }

export async function GET() {
  const session = await requireAuth()
  const items = await listAIConversations(session.userId)
  return NextResponse.json({ items }, { headers: NO_STORE })
}

export async function POST(req: NextRequest) {
  const session = await requireAuth()
  const body = await req.json().catch(() => null)
  const parsed = aiConversationCreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400, headers: NO_STORE })
  }
  const conversation = await createAIConversation(session.userId, parsed.data)
  return NextResponse.json({
    id: conversation.id,
    title: conversation.title,
    createdAt: conversation.createdAt.toISOString(),
    updatedAt: conversation.updatedAt.toISOString(),
    lastMessageAt: conversation.lastMessageAt.toISOString(),
  }, { status: 201, headers: NO_STORE })
}
