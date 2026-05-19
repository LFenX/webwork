import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { getCurrentAdmin } from "@/lib/admin"
import { jsonError } from "@/lib/sql-lab/service"
import { refreshSchemaProfiles } from "@/lib/sql-lab/profiler"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const NO_STORE = { "Cache-Control": "no-store" } as const

export async function POST(req: NextRequest) {
  try {
    await requireAuth()
    const admin = await getCurrentAdmin()
    if (!admin?.permissions.manageSqlLab) {
      return NextResponse.json({ error: "没有 SQL Lab 管理权限" }, { status: 403, headers: NO_STORE })
    }
    const body = (await req.json().catch(() => ({}))) as { mode?: string; schemas?: string[] }
    const mode = body.mode === "full" ? "full" : "light"
    const schemas = Array.isArray(body.schemas) && body.schemas.length ? body.schemas.map(String) : ["public"]
    const result = await refreshSchemaProfiles({ mode, schemas })
    return NextResponse.json(result, { headers: NO_STORE })
  } catch (error) {
    return jsonError(error)
  }
}
