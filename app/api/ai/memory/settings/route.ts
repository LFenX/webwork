import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { updateMemorySettingsSchema } from "@/lib/validators"
import { getMemorySettings, updateMemorySettings } from "@/lib/ai/memory/memory-service"

export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store" }

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "未登录" }, { status: 401, headers: NO_STORE })

  const settings = await getMemorySettings(session.userId)
  return NextResponse.json(settings, { headers: NO_STORE })
}

export async function PATCH(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "未登录" }, { status: 401, headers: NO_STORE })

  const body = await req.json().catch(() => null)
  const parsed = updateMemorySettingsSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "参数错误", detail: parsed.error.flatten() }, { status: 400, headers: NO_STORE })
  }

  await updateMemorySettings(session.userId, parsed.data)
  return NextResponse.json({ ok: true }, { headers: NO_STORE })
}
