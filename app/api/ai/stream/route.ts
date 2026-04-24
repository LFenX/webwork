import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { runAIRuntime } from "@/lib/ai/runtime"
import {
  createAIConversationWithMessages,
  failAssistantMessage,
  finalizeAIRun,
  finalizeAssistantMessage,
  getAIStatusSnapshot,
} from "@/lib/ai/service"
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

  const { conversation, assistantMessage, run } = await createAIConversationWithMessages({
    userId: session.userId,
    conversationId: parsed.data.conversationId,
    prompt: parsed.data.prompt,
    status,
    attachments: parsed.data.attachments,
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
          runId: run.id,
        })

        const runtimeResult = await runAIRuntime({
          userId: session.userId,
          conversationId: conversation.id,
          assistantMessageId: assistantMessage.id,
          runId: run.id,
          prompt: parsed.data.prompt,
          attachments: parsed.data.attachments,
          modelOverride: parsed.data.modelOverride,
          onToken: async () => {},
          onEvent: async (event, payload) => {
            write(event, payload)
          },
        })

        await finalizeAssistantMessage({
          assistantMessageId: assistantMessage.id,
          contentMarkdown: runtimeResult.contentMarkdown,
          reasoningSummary: runtimeResult.reasoningSummary,
          toolTraceSummary: runtimeResult.toolTraceSummary,
          modelName: runtimeResult.modelName,
        })

        write("run_completed", {
          conversationId: conversation.id,
          assistantMessageId: assistantMessage.id,
          runId: run.id,
        })
        controller.close()
      } catch (error) {
        await failAssistantMessage(assistantMessage.id, "生成失败，请稍后重试。")
        await finalizeAIRun({
          runId: run.id,
          status: "failed",
          summary: error instanceof Error ? error.message : "Stream failed",
        }).catch(() => null)
        write("run_failed", {
          runId: run.id,
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
