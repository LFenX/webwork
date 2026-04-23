import { NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { getFriendOrNull } from "@/lib/chat"
import { subscribeChat } from "@/lib/chat-events"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(
  req: Request,
  { params }: { params: Promise<{ friendId: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "未登录" }, { status: 401 })

  const { friendId } = await params
  const friend = await getFriendOrNull(session.userId, friendId)
  if (!friend) return NextResponse.json({ error: "只能连接好友聊天" }, { status: 403 })

  const encoder = new TextEncoder()
  let unsubscribe: (() => void) | null = null
  let heartbeat: ReturnType<typeof setInterval> | null = null

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const write = (chunk: string) => controller.enqueue(encoder.encode(chunk))
      write(`event: ready\ndata: ${JSON.stringify({ ok: true })}\n\n`)

      unsubscribe = subscribeChat(session.userId, (message) => {
        const isCurrentChat =
          (message.senderId === session.userId && message.receiverId === friendId) ||
          (message.senderId === friendId && message.receiverId === session.userId)
        if (isCurrentChat) write(`event: message\ndata: ${JSON.stringify(message)}\n\n`)
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
