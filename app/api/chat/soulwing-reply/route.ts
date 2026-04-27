import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { generateSoulWingChatReply } from "@/lib/ai/chat-reply/soulwing-chat-reply-service"
import { z } from "zod"

const schema = z.object({
  chatType: z.enum(["direct", "group"]),
  conversationId: z.string().min(1),
  limit: z.number().min(1).max(100).optional().default(50),
  instruction: z.string().optional(),
  mode: z.enum(["draft", "auto_send"]).optional().default("draft"),
})

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  const session = await requireAuth()
  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "参数错误", detail: parsed.error.flatten() }, { status: 400 })
  }

  const result = await generateSoulWingChatReply({
    userId: session.userId,
    chatType: parsed.data.chatType,
    conversationId: parsed.data.conversationId,
    limit: parsed.data.limit,
    instruction: parsed.data.instruction,
  })

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 })
  }

  return NextResponse.json({
    ok: true,
    reply: result.reply,
    mode: parsed.data.mode,
    needConfirmation: parsed.data.mode === "auto_send",
    contextUsed: {
      messageCount: result.messageCount,
      chatType: result.chatType,
    },
  })
}
