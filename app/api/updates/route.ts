import { NextRequest, NextResponse } from "next/server"
import { getPublicUpdateSummaries } from "@/lib/update-log"

export const dynamic = "force-dynamic"

const NO_STORE = { "Cache-Control": "no-store" }

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const result = await getPublicUpdateSummaries({
    cursor: searchParams.get("cursor"),
    type: searchParams.get("type"),
    q: searchParams.get("q"),
    from: searchParams.get("from"),
    to: searchParams.get("to"),
    limit: Number(searchParams.get("limit") ?? 20),
  })
  return NextResponse.json(result, { headers: NO_STORE })
}
