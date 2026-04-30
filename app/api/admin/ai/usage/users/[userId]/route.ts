import { NextRequest, NextResponse } from "next/server"
import { requireAdminPermission } from "@/lib/admin"
import { computeUsageUserDetail, parseUsageFilterFromSearchParams } from "@/lib/ai/usage-stats"

export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store" }

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    await requireAdminPermission("manageAI")
    const { userId } = await params
    if (!userId) {
      return NextResponse.json({ error: "INVALID_USER_ID" }, { status: 400, headers: NO_STORE })
    }
    const filter = parseUsageFilterFromSearchParams(req.nextUrl.searchParams, { userId })
    const detail = await computeUsageUserDetail(userId, filter)
    if (!detail) {
      return NextResponse.json({ error: "USER_NOT_FOUND" }, { status: 404, headers: NO_STORE })
    }
    return NextResponse.json(detail, { headers: NO_STORE })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Forbidden"
    const status = message === "FORBIDDEN" ? 403 : 500
    return NextResponse.json({ error: message }, { status, headers: NO_STORE })
  }
}
