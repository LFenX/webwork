import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { validateSql } from "@/lib/sql-lab/service"
import type { SqlValidateRequest } from "@/lib/sql-lab/types"

export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store" } as const

export async function POST(req: NextRequest) {
  const session = await requireAuth()
  const body = (await req.json().catch(() => ({}))) as SqlValidateRequest
  const result = await validateSql(session.userId, body)
  return NextResponse.json(result, { headers: NO_STORE })
}
