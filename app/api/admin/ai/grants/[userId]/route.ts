import { NextRequest, NextResponse } from "next/server"
import { requireAdminPermission } from "@/lib/admin"
import { upsertAIGrant } from "@/lib/ai/service"
import { aiGrantSchema } from "@/lib/validators"

export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store" }

export async function PUT(req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  try {
    const admin = await requireAdminPermission("manageAI")
    const { userId } = await params
    const body = await req.json().catch(() => null)
    const parsed = aiGrantSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400, headers: NO_STORE })
    }
    const grant = await upsertAIGrant(admin.id, userId, parsed.data)
    return NextResponse.json({
      userId: grant.userId,
      status: grant.status,
      providerLabel: grant.providerLabel,
      apiKeyMask: grant.apiKeyMask,
      model: grant.model,
      updatedAt: grant.updatedAt.toISOString(),
    }, { headers: NO_STORE })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Forbidden" }, { status: 403, headers: NO_STORE })
  }
}
