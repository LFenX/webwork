import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getSession } from "@/lib/session"

export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store" }

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ commentId: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "未登录" }, { status: 401, headers: NO_STORE })
  const { commentId } = await params
  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: { id: true, authorId: true, post: { select: { userId: true } } },
  })
  if (!comment) return NextResponse.json({ error: "评论不存在" }, { status: 404, headers: NO_STORE })
  if (comment.authorId !== session.userId && comment.post.userId !== session.userId) {
    return NextResponse.json({ error: "无权删除" }, { status: 403, headers: NO_STORE })
  }
  await prisma.comment.delete({ where: { id: commentId } })
  return NextResponse.json({ ok: true }, { headers: NO_STORE })
}
