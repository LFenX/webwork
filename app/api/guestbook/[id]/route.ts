import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getSession } from "@/lib/session"

export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store" }

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "未登录" }, { status: 401, headers: NO_STORE })

  const { id } = await params
  const message = await prisma.guestbookMessage.findUnique({ where: { id }, select: { ownerId: true } })
  if (!message) return NextResponse.json({ error: "留言不存在" }, { status: 404, headers: NO_STORE })

  if (message.ownerId !== session.userId) {
    return NextResponse.json({ error: "无权删除" }, { status: 403, headers: NO_STORE })
  }

  await prisma.guestbookMessage.delete({ where: { id } })
  return NextResponse.json({ ok: true }, { headers: NO_STORE })
}
