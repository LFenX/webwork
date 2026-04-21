import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getSession } from "@/lib/session"

export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store" }

/**
 * PATCH /api/friend-requests/[id] — accept or reject a received request
 * Body: { action: "accept" | "reject" }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "未登录" }, { status: 401, headers: NO_STORE })

  const { id } = await params
  const request = await prisma.friendRequest.findUnique({ where: { id } })
  if (!request || request.toUserId !== session.userId || request.status !== "pending") {
    return NextResponse.json({ error: "无效请求" }, { status: 404, headers: NO_STORE })
  }

  const { action } = await req.json()
  if (action !== "accept" && action !== "reject") {
    return NextResponse.json({ error: "action 必须是 accept 或 reject" }, { status: 400, headers: NO_STORE })
  }

  const now = new Date()
  if (action === "accept") {
    const [a, b] = request.fromUserId < request.toUserId
      ? [request.fromUserId, request.toUserId]
      : [request.toUserId, request.fromUserId]

    await prisma.$transaction([
      prisma.friendRequest.update({
        where: { id },
        data: { status: "accepted", respondedAt: now },
      }),
      prisma.friendship.upsert({
        where: { userAId_userBId: { userAId: a, userBId: b } },
        update: {},
        create: { userAId: a, userBId: b },
      }),
    ])
  } else {
    await prisma.friendRequest.update({
      where: { id },
      data: { status: "rejected", respondedAt: now },
    })
  }

  return NextResponse.json({ ok: true }, { headers: NO_STORE })
}

/**
 * DELETE /api/friend-requests/[id] — cancel a sent request or remove a friendship
 * If the id looks like a friendship id, remove the friendship; otherwise cancel the request.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "未登录" }, { status: 401, headers: NO_STORE })

  const { id } = await params

  // Try as friend request first
  const request = await prisma.friendRequest.findUnique({ where: { id } })
  if (request) {
    if (request.fromUserId !== session.userId) {
      return NextResponse.json({ error: "无权操作" }, { status: 403, headers: NO_STORE })
    }
    await prisma.friendRequest.update({ where: { id }, data: { status: "canceled" } })
    return NextResponse.json({ ok: true }, { headers: NO_STORE })
  }

  // Try as friendship
  const friendship = await prisma.friendship.findUnique({ where: { id } })
  if (friendship) {
    if (friendship.userAId !== session.userId && friendship.userBId !== session.userId) {
      return NextResponse.json({ error: "无权操作" }, { status: 403, headers: NO_STORE })
    }
    await prisma.friendship.delete({ where: { id } })
    return NextResponse.json({ ok: true }, { headers: NO_STORE })
  }

  return NextResponse.json({ error: "未找到" }, { status: 404, headers: NO_STORE })
}
