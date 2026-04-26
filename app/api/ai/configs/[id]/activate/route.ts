import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { getAIUserConfigById, activateAIUnifiedConfig } from "@/lib/ai/service"
import { aiConfigActivateSchema } from "@/lib/validators"

export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store" }

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await requireAuth()

  const body = await req.json().catch(() => null)
  const parsed = aiConfigActivateSchema.safeParse(body ?? {})
  const source = parsed.success ? parsed.data.source : "self"

  try {
    await activateAIUnifiedConfig(session.userId, id, source)
    return NextResponse.json({ success: true }, { headers: NO_STORE })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to activate config"
    const code = (error as Error & { code?: string }).code
    if (code === "GRANT_PAUSED" || code === "GRANT_REVOKED") {
      return NextResponse.json({ error: message, code }, { status: 409, headers: NO_STORE })
    }
    if (message === "NOT_FOUND") {
      return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE })
    }
    return NextResponse.json({ error: message }, { status: 503, headers: NO_STORE })
  }
}
