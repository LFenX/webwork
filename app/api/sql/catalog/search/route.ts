import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { getEffectiveSchema, jsonError } from "@/lib/sql-lab/service"
import { searchSqlCatalog } from "@/lib/sql-lab/table-catalog"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const NO_STORE = { "Cache-Control": "no-store" } as const

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth()
    const q = req.nextUrl.searchParams.get("q")?.trim() ?? ""
    const schema = await getEffectiveSchema(session.userId)
    const matches = q ? searchSqlCatalog(schema, { prompt: q }, 20) : []
    return NextResponse.json({ matches }, { headers: NO_STORE })
  } catch (error) {
    return jsonError(error)
  }
}
