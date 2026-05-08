import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { executeSql } from "@/lib/sql-lab/service"
import type { SqlRunRequest } from "@/lib/sql-lab/types"

export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store" } as const

export async function POST(req: NextRequest) {
  const session = await requireAuth()
  const body = (await req.json().catch(() => ({}))) as SqlRunRequest
  const result = await executeSql(session.userId, body, {
    ipAddress: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined,
    userAgent: req.headers.get("user-agent") || undefined,
  })
  return NextResponse.json(result, { headers: NO_STORE })
}
