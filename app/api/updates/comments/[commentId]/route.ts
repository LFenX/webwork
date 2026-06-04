import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getSession } from "@/lib/session"
import { isAdminLikeRole, normalizeUserRole } from "@/lib/admin"

export const dynamic = "force-dynamic"

const NO_STORE = { "Cache-Control": "no-store" }

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ commentId: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "请先登录" }, { status: 401, headers: NO_STORE })

  const { commentId } = await params
  const comment = await prisma.updateLogComment.findUnique({
    where: { id: commentId },
    select: { id: true, authorId: true },
  })
  if (!comment) return NextResponse.json({ error: "评论不存在" }, { status: 404, headers: NO_STORE })

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, email: true, displayName: true, role: true },
  })
  const normalized = user ? await normalizeUserRole(user) : null
  const canModerate = normalized ? isAdminLikeRole(normalized.role) : false

  if (comment.authorId !== session.userId && !canModerate) {
    return NextResponse.json({ error: "无权删除这条评论" }, { status: 403, headers: NO_STORE })
  }

  await prisma.updateLogComment.delete({ where: { id: commentId } })
  return NextResponse.json({ ok: true }, { headers: NO_STORE })
}
