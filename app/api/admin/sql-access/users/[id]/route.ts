import { NextRequest, NextResponse } from "next/server"
import { requireAdminPermission } from "@/lib/admin"
import { getGrantDetail, jsonError, upsertGrant } from "@/lib/sql-lab/service"

export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store" } as const

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireAdminPermission("manageSqlLab")
    const { id } = await ctx.params
    return NextResponse.json(await getGrantDetail(id), { headers: NO_STORE })
  } catch (error) {
    return jsonError(error)
  }
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdminPermission("manageSqlLab")
    const { id } = await ctx.params
    const body = await req.json().catch(() => ({}))
    return NextResponse.json(await upsertGrant(id, admin.id, body), { headers: NO_STORE })
  } catch (error) {
    return jsonError(error)
  }
}
