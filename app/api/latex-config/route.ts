import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { getAIConversationOrThrow } from "@/lib/ai/service"
import { getDocConfig, setDocConfig } from "@/lib/latex/doc-config-service"
import { listLatexTemplates } from "@/lib/latex/templates"
import { listLatexThemes } from "@/lib/latex/themes"
import { LATEX_PALETTES } from "@/lib/latex/palettes"
import type { LatexDocConfig } from "@/lib/latex/config-schema"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// GET ?conversationId=... → current config + the template/palette catalogue.
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const conversationId = req.nextUrl.searchParams.get("conversationId") || ""
  const catalogue = {
    templates: listLatexTemplates(),
    themes: listLatexThemes(),
    palettes: LATEX_PALETTES.map(({ id, name, accent }) => ({ id, name, accent })),
  }
  if (!conversationId) {
    return NextResponse.json({ config: null, ...catalogue })
  }
  const conversation = await getAIConversationOrThrow(session.userId, conversationId).catch(() => null)
  if (!conversation) return NextResponse.json({ error: "not_found" }, { status: 404 })

  const config = await getDocConfig(session.userId, conversationId)
  return NextResponse.json({ config, ...catalogue })
}

// PUT { conversationId, patch } → updates and returns the merged config.
export async function PUT(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => null)
  const conversationId = typeof body?.conversationId === "string" ? body.conversationId : ""
  if (!conversationId) return NextResponse.json({ error: "missing_conversation" }, { status: 400 })

  const conversation = await getAIConversationOrThrow(session.userId, conversationId).catch(() => null)
  if (!conversation) return NextResponse.json({ error: "not_found" }, { status: 404 })

  const patch = (body?.patch && typeof body.patch === "object" ? body.patch : {}) as Partial<LatexDocConfig>
  const config = await setDocConfig(session.userId, conversationId, patch)
  return NextResponse.json({ config })
}
