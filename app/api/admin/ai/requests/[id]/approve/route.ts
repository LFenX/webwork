import { NextRequest, NextResponse } from "next/server"
import { requireAdminPermission } from "@/lib/admin"
import { approveAIAccessRequest } from "@/lib/ai/service"
import { aiRequestReviewSchema } from "@/lib/validators"

export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store" }

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdminPermission("manageAI")
    const { id } = await params
    const body = await req.json().catch(() => null)
    const parsed = aiRequestReviewSchema.safeParse(body ?? {})
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400, headers: NO_STORE })
    }
    const item = await approveAIAccessRequest(admin.id, id, parsed.data.reviewNote)
    return NextResponse.json({ id: item.id, status: item.status }, { headers: NO_STORE })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Forbidden" }, { status: 403, headers: NO_STORE })
  }
}
