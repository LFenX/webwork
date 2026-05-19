import { NextResponse } from "next/server"
import { requireSqlPracticeOwner } from "@/lib/sql-practice/access"
import { listGrants } from "@/lib/sql-practice/service"

export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store" } as const

export async function GET() {
  try {
    await requireSqlPracticeOwner()
  } catch {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403, headers: NO_STORE })
  }
  const items = await listGrants()
  return NextResponse.json({ items }, { headers: NO_STORE })
}
