import { NextResponse } from "next/server"
import { requireAdminPermission } from "@/lib/admin"
import { getAdminAIOverview } from "@/lib/ai/service"

export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store" }

export async function GET() {
  try {
    await requireAdminPermission("manageAI")
    const data = await getAdminAIOverview()
    return NextResponse.json(data, { headers: NO_STORE })
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: NO_STORE })
  }
}
