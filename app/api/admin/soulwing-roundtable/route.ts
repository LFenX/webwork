import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import {
  deleteRoundtableDiscussion,
  deleteRoundtableMessage,
  getRoundtableState,
  startRoundtableDiscussion,
  updateRoundtableParticipantByAdmin,
  updateRoundtableSettings,
} from "@/lib/soulwing-roundtable"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const NO_STORE = { "Cache-Control": "no-store" }

function forbidden() {
  return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: NO_STORE })
}

async function requireOwner() {
  const admin = await requireAdmin().catch(() => null)
  if (!admin || admin.role !== "owner") return null
  return admin
}

export async function GET() {
  const admin = await requireOwner()
  if (!admin) return forbidden()
  return NextResponse.json(await getRoundtableState(admin.id), { headers: NO_STORE })
}

export async function PATCH(req: NextRequest) {
  const admin = await requireOwner()
  if (!admin) return forbidden()
  const body = await req.json().catch(() => ({}))

  if (body.action === "participant") {
    const targetUserId = typeof body.targetUserId === "string" ? body.targetUserId : ""
    if (!targetUserId) {
      return NextResponse.json({ error: "targetUserId is required" }, { status: 400, headers: NO_STORE })
    }
    const participant = await updateRoundtableParticipantByAdmin(admin.id, targetUserId, {
      adminPaused: Boolean(body.adminPaused),
      pauseReason: typeof body.pauseReason === "string" ? body.pauseReason : "",
    })
    return NextResponse.json({ participant }, { headers: NO_STORE })
  }

  const settings = await updateRoundtableSettings(admin.id, body)
  return NextResponse.json({ settings }, { headers: NO_STORE })
}

export async function POST(req: NextRequest) {
  const admin = await requireOwner()
  if (!admin) return forbidden()
  const body = await req.json().catch(() => ({}))
  try {
    const styleConfig = body.styleConfig && typeof body.styleConfig === "object"
      ? {
          styles: Array.isArray(body.styleConfig.styles)
            ? body.styleConfig.styles.filter(
                (s: unknown) => s && typeof s === "object" && typeof (s as Record<string, unknown>).id === "string" && typeof (s as Record<string, unknown>).intensity === "number",
              ).map((s: Record<string, unknown>) => ({ id: String(s.id), intensity: Math.min(10, Math.max(0, Number(s.intensity) || 0)) }))
            : [],
        }
      : null
    const turnCount = typeof body.turnCount === "number" && body.turnCount >= 5 && body.turnCount <= 80
      ? body.turnCount
      : null
    const discussionId = await startRoundtableDiscussion({
      slot: body.slot === "morning" || body.slot === "evening" ? body.slot : "manual",
      source: "admin",
      topicTitle: String(body.topicTitle ?? "").trim() || "临时圆桌议题",
      topicDescription: String(body.topicDescription ?? "").trim(),
      topicType: String(body.topicType ?? "custom").trim() || "custom",
      initiatedById: admin.id,
      updateAnnouncementSlot: body.updateAnnouncementSlot === "morning" || body.updateAnnouncementSlot === "evening" ? body.updateAnnouncementSlot : null,
      force: Boolean(body.force),
      turnCount,
      styleConfig,
    })
    return NextResponse.json({ discussionId }, { status: 201, headers: NO_STORE })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "发起失败" }, { status: 400, headers: NO_STORE })
  }
}

export async function DELETE(req: NextRequest) {
  const admin = await requireOwner()
  if (!admin) return forbidden()
  const body = await req.json().catch(() => ({}))

  if (typeof body.messageId === "string" && body.messageId) {
    await deleteRoundtableMessage(admin.id, body.messageId)
    return NextResponse.json({ ok: true }, { headers: NO_STORE })
  }
  if (typeof body.discussionId === "string" && body.discussionId) {
    await deleteRoundtableDiscussion(admin.id, body.discussionId)
    return NextResponse.json({ ok: true }, { headers: NO_STORE })
  }
  return NextResponse.json({ error: "messageId or discussionId is required" }, { status: 400, headers: NO_STORE })
}
