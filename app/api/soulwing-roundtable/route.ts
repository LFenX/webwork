import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { getCurrentAdmin } from "@/lib/admin"
import { createUserRoundtableOpinion, getRoundtableState, updateMyRoundtableParticipation } from "@/lib/soulwing-roundtable"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const NO_STORE = { "Cache-Control": "no-store" }

export async function GET() {
  const session = await requireAuth()
  const [state, admin] = await Promise.all([getRoundtableState(session.userId), getCurrentAdmin()])
  return NextResponse.json({ ...state, isUltimateAdmin: admin?.role === "owner" }, { headers: NO_STORE })
}

export async function POST(req: NextRequest) {
  const session = await requireAuth()
  const body = await req.json().catch(() => ({}))
  try {
    const rawMode = typeof body.mode === "string" ? body.mode : "user_message"
    const mode: "user_message" | "proxy" | "mention" | "followup" =
      rawMode === "proxy" ? "proxy"
        : rawMode === "mention" ? "mention"
        : rawMode === "followup" ? "followup"
        : "user_message"
    const message = await createUserRoundtableOpinion(session.userId, {
      discussionId: typeof body.discussionId === "string" ? body.discussionId : undefined,
      userOpinion: typeof body.userOpinion === "string" ? body.userOpinion : undefined,
      targetUserId: typeof body.targetUserId === "string" ? body.targetUserId : undefined,
      mode,
    })
    return NextResponse.json({ message }, { status: 201, headers: NO_STORE })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "发表失败" }, { status: 400, headers: NO_STORE })
  }
}

export async function PATCH(req: NextRequest) {
  const session = await requireAuth()
  const body = await req.json().catch(() => ({}))
  if (typeof body.enabled !== "boolean") {
    return NextResponse.json({ error: "enabled must be boolean" }, { status: 400, headers: NO_STORE })
  }
  const participant = await updateMyRoundtableParticipation(session.userId, body.enabled)
  return NextResponse.json({ participant }, { headers: NO_STORE })
}
