import { NextResponse } from "next/server"
import { requireAdminPermission } from "@/lib/admin"
import { getGrantSummaries, jsonError } from "@/lib/sql-lab/service"

export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store" } as const

export async function GET() {
  try {
    await requireAdminPermission("manageSqlLab")
    return NextResponse.json({ items: await getGrantSummaries() }, { headers: NO_STORE })
  } catch (error) {
    return jsonError(error)
  }
}
