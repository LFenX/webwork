import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getSession } from "@/lib/session"
import { publishRealtime } from "@/lib/realtime-events"

export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store" }

/**
 * GET /api/friend-requests?direction=received|sent
 * Returns pending requests from/to current user.
 */
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "未登录" }, { status: 401, headers: NO_STORE })

  const direction = req.nextUrl.searchParams.get("direction") ?? "received"
  const uid = session.userId

  const requests = await prisma.friendRequest.findMany({
    where: {
      status: "pending",
      ...(direction === "sent" ? { fromUserId: uid } : { toUserId: uid }),
    },
    include: {
      from: { select: { id: true, email: true, displayName: true } },
      to: { select: { id: true, email: true, displayName: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json(requests, { headers: NO_STORE })
}

/**
 * POST /api/friend-requests — send a friend request by email
 * Body: { email: string }
 */
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "未登录" }, { status: 401, headers: NO_STORE })

  const body = await req.json().catch(() => null)
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : ""
  const note = typeof body?.note === "string" ? body.note.trim().slice(0, 120) : ""
  if (!note) return NextResponse.json({ error: "请填写好友申请备注" }, { status: 400, headers: NO_STORE })
  if (!email) return NextResponse.json({ error: "请输入邮箱" }, { status: 400, headers: NO_STORE })

  if (email === session.email.toLowerCase()) {
    return NextResponse.json({ error: "不能向自己发送好友请求" }, { status: 400, headers: NO_STORE })
  }

  const target = await prisma.user.findUnique({ where: { email } })
  if (!target) {
    return NextResponse.json({ error: "未找到该邮箱对应的用户" }, { status: 404, headers: NO_STORE })
  }

  // Check if already friends
  const [a, b] = session.userId < target.id ? [session.userId, target.id] : [target.id, session.userId]
  const existing = await prisma.friendship.findUnique({ where: { userAId_userBId: { userAId: a, userBId: b } } })
  if (existing) {
    return NextResponse.json({ error: "已经是好友了" }, { status: 409, headers: NO_STORE })
  }

  // Check for existing pending request
  const pendingReq = await prisma.friendRequest.findUnique({
    where: { fromUserId_toUserId: { fromUserId: session.userId, toUserId: target.id } },
  })
  if (pendingReq && pendingReq.status === "pending") {
    return NextResponse.json({ error: "已发送过好友请求，等待对方确认" }, { status: 409, headers: NO_STORE })
  }

  // Check if the other party already sent us a request — if so, accept directly
  const reverseReq = await prisma.friendRequest.findUnique({
    where: { fromUserId_toUserId: { fromUserId: target.id, toUserId: session.userId } },
  })
  if (reverseReq && reverseReq.status === "pending") {
    const now = new Date()
    await prisma.$transaction([
      prisma.friendRequest.update({
        where: { id: reverseReq.id },
        data: { status: "accepted", respondedAt: now, note },
      }),
      prisma.friendship.upsert({
        where: { userAId_userBId: { userAId: a, userBId: b } },
        update: {},
        create: { userAId: a, userBId: b },
      }),
    ])
    publishRealtime([session.userId, target.id], { type: "friend-request:accepted", data: { requestId: reverseReq.id, userIds: [session.userId, target.id] } })
    return NextResponse.json({ message: "对方已向你发出请求，已自动成为好友" }, { headers: NO_STORE })
  }

  const request = await prisma.friendRequest.upsert({
    where: { fromUserId_toUserId: { fromUserId: session.userId, toUserId: target.id } },
    update: { status: "pending", respondedAt: null, createdAt: new Date(), note },
    create: { fromUserId: session.userId, toUserId: target.id, note },
  })
  publishRealtime(target.id, { type: "friend-request:created", data: { id: request.id, fromUserId: session.userId, toUserId: target.id } })

  return NextResponse.json(request, { status: 201, headers: NO_STORE })
}
