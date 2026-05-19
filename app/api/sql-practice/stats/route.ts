import { NextRequest, NextResponse } from "next/server"
import { requireSqlPracticeAccess } from "@/lib/sql-practice/access"
import { getStats } from "@/lib/sql-practice/service"

export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store" } as const

export async function GET(req: NextRequest) {
  let access
  try {
    access = await requireSqlPracticeAccess()
  } catch {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403, headers: NO_STORE })
  }
  const days = Math.min(Math.max(Number(req.nextUrl.searchParams.get("days") ?? 30), 7), 180)
  const stats = await getStats(access.userId, days)
  return NextResponse.json(stats, { headers: NO_STORE })
}
