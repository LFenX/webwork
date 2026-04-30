import { NextResponse } from "next/server"
import { requireAdminPermission } from "@/lib/admin"
import { listProviderModelOptions } from "@/lib/ai/usage-stats"

export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store" }

export async function GET() {
  try {
    await requireAdminPermission("manageAI")
    const options = await listProviderModelOptions()
    return NextResponse.json(options, { headers: NO_STORE })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Forbidden"
    const status = message === "FORBIDDEN" ? 403 : 500
    return NextResponse.json({ error: message }, { status, headers: NO_STORE })
  }
}
