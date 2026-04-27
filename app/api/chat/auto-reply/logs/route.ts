import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/db"

export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store" }

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "未登录" }, { status: 401, headers: NO_STORE })

  const { searchParams } = req.nextUrl
  const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 20, 1), 50)

  const items = await prisma.autoReplyLog.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true, chatType: true, conversationId: true, replyText: true,
      replyMode: true, reason: true, createdAt: true,
    },
  })

  return NextResponse.json({ items }, { headers: NO_STORE })
}
