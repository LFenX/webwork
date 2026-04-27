import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/db"
import { z } from "zod"

export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store" }

const AUTO_REPLY_ENABLED = process.env.SOULWING_AUTO_REPLY_ENABLED === "true"

const createSchema = z.object({
  enabled: z.boolean().optional().default(false),
  scope: z.string().optional().default("global"),
  chatType: z.string().nullable().optional(),
  conversationId: z.string().nullable().optional(),
  triggerMode: z.string().optional().default("manual"),
  idleMinutes: z.number().min(1).max(1440).nullable().optional(),
  replyMode: z.string().optional().default("away_notice"),
  templateText: z.string().nullable().optional(),
  customInstruction: z.string().nullable().optional(),
  discloseAsAutoReply: z.boolean().optional().default(true),
  allowGroupReply: z.boolean().optional().default(false),
  cooldownMinutes: z.number().min(5).max(1440).optional().default(30),
  maxRepliesPerDay: z.number().min(1).max(100).optional().default(20),
})

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "未登录" }, { status: 401, headers: NO_STORE })
  const items = await prisma.autoReplySetting.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "desc" },
  })
  return NextResponse.json({ items }, { headers: NO_STORE })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "未登录" }, { status: 401, headers: NO_STORE })

  const body = await req.json().catch(() => null)
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "参数错误" }, { status: 400, headers: NO_STORE })

  const data = parsed.data
  if (!AUTO_REPLY_ENABLED) {
    data.enabled = false
    data.allowGroupReply = false
  }

  const item = await prisma.autoReplySetting.create({
    data: { userId: session.userId, ...data },
  })
  return NextResponse.json({ ...item, featureEnabled: AUTO_REPLY_ENABLED }, { status: 201, headers: NO_STORE })
}
