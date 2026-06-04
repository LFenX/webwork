import { NextRequest } from "next/server"
import { requireAuth } from "@/lib/auth"
import { getAIRunByMessageId } from "@/lib/ai/service"
import { getRunSnapshot, subscribeRun } from "@/lib/ai/run-stream-bus"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Re-attach to an in-progress run and resume live streaming. Sends a `snapshot`
// of the content accumulated so far, then forwards live events until the run
// finishes. If there's no in-process producer for this run (e.g. after a server
// restart, or a different instance), emits `stream_unavailable` so the client
// falls back to polling.
export async function GET(req: NextRequest, { params }: { params: Promise<{ messageId: string }> }) {
  const session = await requireAuth()
  const { messageId } = await params

  const run = await getAIRunByMessageId(session.userId, messageId, false)
  if (!run) {
    return new Response("Not found", { status: 404 })
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false
      const write = (event: string, data: unknown) => {
        try { controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)) } catch { /* closed */ }
      }
      const close = () => { if (!closed) { closed = true; try { controller.close() } catch { /* ignore */ } } }

      controller.enqueue(encoder.encode(": ok\n\n"))
      write("conversation", { conversationId: run.conversationId, assistantMessageId: messageId, runId: run.id })

      const snapshot = getRunSnapshot(run.id)

      // No live producer in this process. Either it already finished, or it's
      // running elsewhere — tell the client to fall back to polling.
      if (!snapshot) {
        write("stream_unavailable", { runId: run.id, status: run.status })
        close()
        return
      }

      // Hand the late joiner everything produced so far, then live events. Taking
      // the snapshot and subscribing back-to-back is gap-free (single-threaded).
      write("snapshot", { contentMarkdown: snapshot.content, draftProgress: snapshot.draftProgress })

      if (snapshot.terminal) {
        write(snapshot.terminal.event, snapshot.terminal.payload)
        close()
        return
      }

      const unsubscribe = subscribeRun(run.id, ({ event, payload }) => {
        write(event, payload)
        if (event === "run_completed" || event === "run_failed" || event === "run_cancelled") {
          unsubscribe()
          close()
        }
      })

      req.signal.addEventListener("abort", () => { unsubscribe(); close() })
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
