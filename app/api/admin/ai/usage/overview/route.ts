import { NextRequest, NextResponse } from "next/server"
import { requireAdminPermission } from "@/lib/admin"
import {
  computeUsageOverview,
  computeUsageByConfigSource,
  parseUsageFilterFromSearchParams,
} from "@/lib/ai/usage-stats"

export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store" }

export async function GET(req: NextRequest) {
  try {
    await requireAdminPermission("manageAI")
    const filter = parseUsageFilterFromSearchParams(req.nextUrl.searchParams)
    const [totals, configSourceBreakdown] = await Promise.all([
      computeUsageOverview(filter),
      computeUsageByConfigSource(filter),
    ])
    return NextResponse.json(
      { totals, configSourceBreakdown },
      { headers: NO_STORE },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : "Forbidden"
    const status = message === "FORBIDDEN" ? 403 : 500
    return NextResponse.json({ error: message }, { status, headers: NO_STORE })
  }
}
