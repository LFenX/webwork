import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { runAIRuntime } from "@/lib/ai/runtime"
import { createAIConversationWithMessages, failAssistantMessage, finalizeAssistantMessage, getAIStatusSnapshot } from "@/lib/ai/service"
import { aiStreamSchema } from "@/lib/validators"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  const session = await requireAuth()
  const body = await req.json().catch(() => null)
  const parsed = aiStreamSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
  }

  const status = await getAIStatusSnapshot(session.userId)
  if (!status.canUseAI) {
    return NextResponse.json({ error: "AI access is not available", status }, { status: 403 })
  }

  const { conversation, assistantMessage } = await createAIConversationWithMessages({
    userId: session.userId,
    conversationId: parsed.data.conversationId,
    prompt: parsed.data.prompt,
    status,
  })

  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const write = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
      }

      try {
        write("conversation", {
          conversationId: conversation.id,
          assistantMessageId: assistantMessage.id,
        })
        write("reasoning", {
          summary: "正在分析问题，并按权限规则匹配需要读取的工具。",
        })

        let latestToolSummary = "尚未执行工具。"
        const runtimeResult = await runAIRuntime({
          userId: session.userId,
          conversationId: conversation.id,
          assistantMessageId: assistantMessage.id,
          prompt: parsed.data.prompt,
          onToken: async (chunk) => {
            write("chunk", { content: chunk })
          },
        })

        latestToolSummary = runtimeResult.toolTraceSummary
        write("tool", { summary: latestToolSummary })

        await finalizeAssistantMessage({
          assistantMessageId: assistantMessage.id,
          contentMarkdown: runtimeResult.contentMarkdown,
          reasoningSummary: runtimeResult.reasoningSummary,
          toolTraceSummary: latestToolSummary,
          modelName: runtimeResult.modelName,
        })

        write("done", {
          conversationId: conversation.id,
          assistantMessageId: assistantMessage.id,
        })
        controller.close()
      } catch (error) {
        await failAssistantMessage(assistantMessage.id, "生成失败，请稍后重试。")
        write("error", {
          message: error instanceof Error ? error.message : "Stream failed",
        })
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}
