import { NextRequest, NextResponse } from "next/server"
import { requireAdminPermission } from "@/lib/admin"
import { deleteAIGrant, upsertAIGrant } from "@/lib/ai/service"
import { getSafeWebSearchConfig, upsertWebSearchConfig } from "@/lib/web-search/credential-service"
import { aiGrantUpsertSchema } from "@/lib/validators"

export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store" }

export async function PUT(req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  try {
    const admin = await requireAdminPermission("manageAI")
    const { userId } = await params
    const body = await req.json().catch(() => null)
    const parsed = aiGrantUpsertSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400, headers: NO_STORE })
    }
    const grant = await upsertAIGrant(admin.id, userId, parsed.data)
    const webSearch = parsed.data.webSearch
      ? await upsertWebSearchConfig("ADMIN_GRANT", grant.id, parsed.data.webSearch)
      : await getSafeWebSearchConfig("ADMIN_GRANT", grant.id)
    return NextResponse.json({
      userId: grant.userId,
      status: grant.status,
      providerLabel: grant.providerLabel,
      apiKeyMask: grant.apiKeyMask,
      model: grant.model,
      webSearchEnabled: grant.webSearchEnabled,
      webSearch,
      updatedAt: grant.updatedAt.toISOString(),
    }, { headers: NO_STORE })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Forbidden"
    const status = message.includes("AI_SECRET_KEY") ? 503 : 403
    return NextResponse.json({ error: message }, { status, headers: NO_STORE })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  try {
    const admin = await requireAdminPermission("manageAI")
    const { userId } = await params
    await deleteAIGrant(admin.id, userId)
    return NextResponse.json({ success: true }, { headers: NO_STORE })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Forbidden"
    return NextResponse.json({ error: message }, { status: message === "NOT_FOUND" ? 404 : 403, headers: NO_STORE })
  }
}
