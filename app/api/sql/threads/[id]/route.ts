import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { jsonError } from "@/lib/sql-lab/service"
import {
  archiveSqlThread,
  deleteSqlThread,
  getSqlThreadDetail,
  renameSqlThread,
  setThreadPinned,
} from "@/lib/sql-lab/threads"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const NO_STORE = { "Cache-Control": "no-store" } as const

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth()
    const { id } = await ctx.params
    const thread = await getSqlThreadDetail(session.userId, id)
    return NextResponse.json(thread, { headers: NO_STORE })
  } catch (error) {
    return jsonError(error)
  }
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth()
    const { id } = await ctx.params
    const body = await req.json().catch(() => ({})) as { title?: string; pinned?: boolean; archived?: boolean }
    if (body.archived) {
      await archiveSqlThread(session.userId, id)
      return new NextResponse(null, { status: 204, headers: NO_STORE })
    }
    if (typeof body.pinned === "boolean") {
      const updated = await setThreadPinned(session.userId, id, body.pinned)
      return NextResponse.json(updated, { headers: NO_STORE })
    }
    if (typeof body.title === "string") {
      const updated = await renameSqlThread(session.userId, id, body.title)
      return NextResponse.json(updated, { headers: NO_STORE })
    }
    return NextResponse.json({ error: "无可更新字段" }, { status: 400, headers: NO_STORE })
  } catch (error) {
    return jsonError(error)
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth()
    const { id } = await ctx.params
    await deleteSqlThread(session.userId, id)
    return new NextResponse(null, { status: 204, headers: NO_STORE })
  } catch (error) {
    return jsonError(error)
  }
}
