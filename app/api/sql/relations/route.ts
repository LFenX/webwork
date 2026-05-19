import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { getRelationGraph, jsonError } from "@/lib/sql-lab/service"

export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store" } as const

export async function GET() {
  try {
    const session = await requireAuth()
    return NextResponse.json(await getRelationGraph(session.userId), { headers: NO_STORE })
  } catch (error) {
    return jsonError(error)
  }
}
