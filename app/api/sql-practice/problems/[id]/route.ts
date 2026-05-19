import { NextRequest, NextResponse } from "next/server"
import { requireSqlPracticeAccess } from "@/lib/sql-practice/access"
import { updatePracticeProblemSchema } from "@/lib/sql-practice/validators"
import { deleteProblem, updateProblem } from "@/lib/sql-practice/service"

export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store" } as const

function forbidden() {
  return NextResponse.json({ error: "FORBIDDEN" }, { status: 403, headers: NO_STORE })
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  let access
  try { access = await requireSqlPracticeAccess() } catch { return forbidden() }
  const { id } = await ctx.params

  const body = await req.json().catch(() => null)
  const parsed = updatePracticeProblemSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "参数错误", detail: parsed.error.flatten() }, { status: 400 })
  }
  const updated = await updateProblem(access.userId, id, parsed.data)
  if (!updated) return NextResponse.json({ error: "未找到" }, { status: 404, headers: NO_STORE })
  return NextResponse.json(updated, { headers: NO_STORE })
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  let access
  try { access = await requireSqlPracticeAccess() } catch { return forbidden() }
  const { id } = await ctx.params
  const ok = await deleteProblem(access.userId, id)
  if (!ok) return NextResponse.json({ error: "未找到" }, { status: 404, headers: NO_STORE })
  return NextResponse.json({ ok: true }, { headers: NO_STORE })
}
