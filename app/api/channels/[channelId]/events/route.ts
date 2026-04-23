import { NextResponse } from "next/server"
import { getChannelForUser } from "@/lib/channel-chat"
import { subscribeChannel } from "@/lib/channel-events"
import { getSession } from "@/lib/session"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(
  req: Request,
  { params }: { params: Promise<{ channelId: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "未登录" }, { status: 401 })

  const { channelId } = await params
  const channel = await getChannelForUser(session.userId, channelId)
  if (!channel) return NextResponse.json({ error: "无权限连接频道" }, { status: 403 })

  const encoder = new TextEncoder()
  let unsubscribe: (() => void) | null = null
  let heartbeat: ReturnType<typeof setInterval> | null = null

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const write = (chunk: string) => controller.enqueue(encoder.encode(chunk))
      write(`event: ready\ndata: ${JSON.stringify({ ok: true })}\n\n`)

      unsubscribe = subscribeChannel(channelId, (message) => {
        write(`event: message\ndata: ${JSON.stringify(message)}\n\n`)
      })

      heartbeat = setInterval(() => {
        write(`event: ping\ndata: ${JSON.stringify({ now: Date.now() })}\n\n`)
      }, 25_000)

      req.signal.addEventListener("abort", () => {
        if (heartbeat) clearInterval(heartbeat)
        unsubscribe?.()
        try {
          controller.close()
        } catch {
          // Connection is already closed.
        }
      })
    },
    cancel() {
      if (heartbeat) clearInterval(heartbeat)
      unsubscribe?.()
    },
  })

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-store, no-transform",
      "Connection": "keep-alive",
      "Content-Type": "text/event-stream; charset=utf-8",
      "X-Accel-Buffering": "no",
    },
  })
}
