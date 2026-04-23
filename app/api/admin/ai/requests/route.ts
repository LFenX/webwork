import { NextResponse } from "next/server"
import { requireAdminPermission } from "@/lib/admin"
import { listAdminAIRequests } from "@/lib/ai/service"

export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store" }

export async function GET() {
  try {
    await requireAdminPermission("manageAI")
    const items = await listAdminAIRequests()
    return NextResponse.json({
      items: items.map((item) => ({
        id: item.id,
        status: item.status,
        message: item.message,
        reviewNote: item.reviewNote,
        createdAt: item.createdAt.toISOString(),
        reviewedAt: item.reviewedAt?.toISOString() ?? null,
        user: item.user,
        reviewedBy: item.reviewedBy,
      })),
    }, { headers: NO_STORE })
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: NO_STORE })
  }
}
