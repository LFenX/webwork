import { NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { subscribeRealtime } from "@/lib/realtime-events"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let cleanup: (() => void) | undefined
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder()
      const send = (event: unknown) => {
        controller.enqueue(encoder.encode(`event: realtime\ndata: ${JSON.stringify(event)}\n\n`))
      }
      const unsubscribe = subscribeRealtime(session.userId, send)
      const heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(": ping\n\n"))
      }, 25_000)

      send({ type: "connected", createdAt: new Date().toISOString(), data: {} })
      cleanup = () => {
        clearInterval(heartbeat)
        unsubscribe()
      }
    },
    cancel() {
      cleanup?.()
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-store, no-transform",
      Connection: "keep-alive",
    },
  })
}
