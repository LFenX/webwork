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
import { archiveConversation } from "@/lib/ai/memory/memory-service"

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
    start(controller) {
      // Open the response body immediately
      controller.enqueue(encoder.encode(": ok\n\n"))

      const enqueue = (chunk: Uint8Array) => {
        try { controller.enqueue(chunk) } catch { /* stream closed */ }
      }

      const write = (event: string, data: unknown) => {
        enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
      }

      let closed = false

      const executeStream = async () => {
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
            onToken: () => {},
            onEvent: (event, payload) => {
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

          // Async memory archive — must not block the SSE stream
          if (runtimeResult.contentMarkdown) {
            void archiveConversation(session.userId, {
              conversationId: conversation.id,
              messageId: assistantMessage.id,
              userPrompt: parsed.data.prompt,
              assistantContent: runtimeResult.contentMarkdown,
              toolExecutions: runtimeResult.toolExecutions?.map((t) => ({ name: t.name, title: t.title })),
            }).catch(() => { /* archive failure must not affect the response */ })
          }

          write("run_completed", {
            conversationId: conversation.id,
            assistantMessageId: assistantMessage.id,
            runId: run.id,
          })
          if (!closed) { closed = true; try { controller.close() } catch { /* ignore */ } }
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
          if (!closed) { closed = true; try { controller.close() } catch { /* ignore */ } }
        }
      }

      void executeStream()
    },
    cancel() {
      // no explicit cleanup needed — close is handled in executeStream
    },
  }, { highWaterMark: 0 })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}
