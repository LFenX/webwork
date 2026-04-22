import { NextRequest, NextResponse } from "next/server"
import crypto from "node:crypto"
import { prisma } from "@/lib/db"
import { getSession } from "@/lib/session"
import { areFriends, getAccessLevel } from "@/lib/permissions"
import { guestbookMessageSchema } from "@/lib/validators"

export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store" }

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "未登录" }, { status: 401, headers: NO_STORE })

  const ownerId = req.nextUrl.searchParams.get("ownerId")
  if (!ownerId) return NextResponse.json({ error: "缺少 ownerId" }, { status: 400, headers: NO_STORE })

  const level = await getAccessLevel(session.userId, ownerId)
  if (level === "none") return NextResponse.json({ error: "无权查看" }, { status: 403, headers: NO_STORE })

  const messages = await prisma.guestbookMessage.findMany({
    where: { ownerId },
    orderBy: { createdAt: "desc" },
    include: {
      author: { select: { id: true, displayName: true, email: true, avatarText: true, avatarUrl: true } },
    },
  })

  return NextResponse.json(
    messages.map((m) => ({
      id: m.id,
      content: m.content,
      createdAt: m.createdAt.toISOString(),
      author: m.author,
    })),
    { headers: NO_STORE }
  )
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "未登录" }, { status: 401, headers: NO_STORE })

  const body = await req.json().catch(() => null)
  const parsed = guestbookMessageSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().formErrors[0] ?? "参数错误" },
      { status: 400, headers: NO_STORE }
    )
  }

  const { ownerId, content } = parsed.data

  if (session.userId === ownerId) {
    return NextResponse.json({ error: "不能给自己留言" }, { status: 400, headers: NO_STORE })
  }

  const friends = await areFriends(session.userId, ownerId)
  if (!friends) return NextResponse.json({ error: "只有好友才能留言" }, { status: 403, headers: NO_STORE })

  const message = await prisma.guestbookMessage.create({
    data: {
      id: crypto.randomUUID(),
      ownerId,
      authorId: session.userId,
      content,
    },
    include: {
      author: { select: { id: true, displayName: true, email: true, avatarText: true, avatarUrl: true } },
    },
  })

  return NextResponse.json(
    {
      id: message.id,
      content: message.content,
      createdAt: message.createdAt.toISOString(),
      author: message.author,
    },
    { status: 201, headers: NO_STORE }
  )
}
