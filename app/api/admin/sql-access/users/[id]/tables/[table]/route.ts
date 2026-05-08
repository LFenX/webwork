import { NextRequest, NextResponse } from "next/server"
import { requireAdminPermission } from "@/lib/admin"
import { deleteTableGrant, jsonError, upsertTableGrant } from "@/lib/sql-lab/service"

export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store" } as const

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; table: string }> }
) {
  try {
    const admin = await requireAdminPermission("manageSqlLab")
    const { id, table } = await ctx.params
    const body = await req.json().catch(() => ({}))
    return NextResponse.json(await upsertTableGrant(id, admin.id, table, body), { headers: NO_STORE })
  } catch (error) {
    return jsonError(error)
  }
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string; table: string }> }
) {
  try {
    await requireAdminPermission("manageSqlLab")
    const { id, table } = await ctx.params
    await deleteTableGrant(id, table)
    return new NextResponse(null, { status: 204, headers: NO_STORE })
  } catch (error) {
    return jsonError(error)
  }
}
