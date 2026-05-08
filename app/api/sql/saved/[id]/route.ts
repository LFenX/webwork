import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { deleteSavedQuery, jsonError, updateSavedQuery } from "@/lib/sql-lab/service"

export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store" } as const

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth()
    const { id } = await ctx.params
    const body = await req.json().catch(() => ({}))
    return NextResponse.json(await updateSavedQuery(session.userId, id, body), { headers: NO_STORE })
  } catch (error) {
    return jsonError(error)
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth()
    const { id } = await ctx.params
    await deleteSavedQuery(session.userId, id)
    return new NextResponse(null, { status: 204, headers: NO_STORE })
  } catch (error) {
    return jsonError(error)
  }
}
