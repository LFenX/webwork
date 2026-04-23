import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { requireAdminPermission } from "@/lib/admin"
import { getSession } from "@/lib/session"
import { publishRealtime } from "@/lib/realtime-events"
import { announcementSchema } from "@/lib/validators"

export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store" }

function serializeAnnouncement(item: {
  id: string
  content: string
  source: string
  fromWorldChannel: boolean
  createdAt: Date
  author: { id: string; email: string; displayName: string }
}) {
  return {
    id: item.id,
    content: item.content,
    source: item.source,
    fromWorldChannel: item.fromWorldChannel,
    createdAt: item.createdAt.toISOString(),
    author: item.author,
  }
}

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "未登录" }, { status: 401, headers: NO_STORE })

  const limit = Math.min(Math.max(Number(req.nextUrl.searchParams.get("limit") ?? 20), 1), 100)
  const history = req.nextUrl.searchParams.get("history") === "1"
  const items = await prisma.announcement.findMany({
    where: history ? { source: "admin" } : {
      source: "admin",
      NOT: {
        views: {
          some: {
            userId: session.userId,
            OR: [{ hidden: true }, { viewCount: { gte: 3 } }],
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { author: { select: { id: true, email: true, displayName: true } } },
  })

  return NextResponse.json({ items: items.map(serializeAnnouncement) }, { headers: NO_STORE })
}

export async function POST(req: NextRequest) {
  const admin = await requireAdminPermission("manageAnnouncements").catch(() => null)
  if (!admin) return NextResponse.json({ error: "无权限" }, { status: 403, headers: NO_STORE })

  const body = await req.json().catch(() => null)
  const parsed = announcementSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().formErrors[0] ?? "公告不能为空" }, { status: 400, headers: NO_STORE })
  }

  const item = await prisma.announcement.create({
    data: {
      authorId: admin.id,
      content: parsed.data.content,
      source: "admin",
      fromWorldChannel: false,
    },
    include: { author: { select: { id: true, email: true, displayName: true } } },
  })
  const users = await prisma.user.findMany({ select: { id: true } })
  publishRealtime(users.map((user) => user.id), { type: "announcement-feed:changed", data: { type: "announcement", id: item.id } })

  return NextResponse.json(serializeAnnouncement(item), { status: 201, headers: NO_STORE })
}
