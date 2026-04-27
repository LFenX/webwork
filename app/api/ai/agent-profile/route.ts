import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { updateAgentProfileSchema } from "@/lib/validators"
import { getOrCreateAgentProfile, updateAgentProfile } from "@/lib/ai/agent-profile-service"

export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store" }

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "未登录" }, { status: 401, headers: NO_STORE })

  const profile = await getOrCreateAgentProfile(session.userId)
  return NextResponse.json(profile, { headers: NO_STORE })
}

export async function PATCH(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "未登录" }, { status: 401, headers: NO_STORE })

  const body = await req.json().catch(() => null)
  const parsed = updateAgentProfileSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "参数错误", detail: parsed.error.flatten() }, { status: 400, headers: NO_STORE })
  }

  await updateAgentProfile(session.userId, parsed.data)
  return NextResponse.json({ ok: true }, { headers: NO_STORE })
}
