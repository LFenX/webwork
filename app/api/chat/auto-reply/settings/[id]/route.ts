import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/db"
import { z } from "zod"

export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store" }

const AUTO_REPLY_ENABLED = process.env.SOULWING_AUTO_REPLY_ENABLED === "true"

const updateSchema = z.object({
  enabled: z.boolean().optional(),
  scope: z.string().optional(),
  chatType: z.string().nullable().optional(),
  conversationId: z.string().nullable().optional(),
  triggerMode: z.string().optional(),
  idleMinutes: z.number().min(1).max(1440).nullable().optional(),
  replyMode: z.string().optional(),
  templateText: z.string().nullable().optional(),
  customInstruction: z.string().nullable().optional(),
  discloseAsAutoReply: z.boolean().optional(),
  allowGroupReply: z.boolean().optional(),
  cooldownMinutes: z.number().min(5).max(1440).optional(),
  maxRepliesPerDay: z.number().min(1).max(100).optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "未登录" }, { status: 401, headers: NO_STORE })

  const { id } = await params
  const existing = await prisma.autoReplySetting.findFirst({ where: { id, userId: session.userId } })
  if (!existing) return NextResponse.json({ error: "未找到" }, { status: 404, headers: NO_STORE })

  const body = await req.json().catch(() => null)
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "参数错误" }, { status: 400, headers: NO_STORE })

  const data = parsed.data
  if (!AUTO_REPLY_ENABLED) {
    if (data.enabled === true) data.enabled = false
    if (data.allowGroupReply === true) data.allowGroupReply = false
  }

  const updated = await prisma.autoReplySetting.update({ where: { id }, data })
  return NextResponse.json({ ...updated, featureEnabled: AUTO_REPLY_ENABLED }, { headers: NO_STORE })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "未登录" }, { status: 401, headers: NO_STORE })

  const { id } = await params
  const existing = await prisma.autoReplySetting.findFirst({ where: { id, userId: session.userId } })
  if (!existing) return NextResponse.json({ error: "未找到" }, { status: 404, headers: NO_STORE })

  // Soft-delete by disabling
  await prisma.autoReplySetting.update({ where: { id }, data: { enabled: false } })
  return NextResponse.json({ ok: true }, { headers: NO_STORE })
}
