import { NextRequest, NextResponse } from "next/server"
import { requireSqlPracticeOwner } from "@/lib/sql-practice/access"
import { grantUpdateSchema } from "@/lib/sql-practice/validators"
import { upsertGrant } from "@/lib/sql-practice/service"

export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store" } as const

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ userId: string }> }) {
  let owner
  try {
    owner = await requireSqlPracticeOwner()
  } catch {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403, headers: NO_STORE })
  }
  const { userId } = await ctx.params
  if (userId === owner.userId) {
    return NextResponse.json({ error: "终极管理员默认拥有权限" }, { status: 400, headers: NO_STORE })
  }
  const body = await req.json().catch(() => null)
  const parsed = grantUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "参数错误", detail: parsed.error.flatten() }, { status: 400 })
  }
  const grant = await upsertGrant(userId, owner.userId, parsed.data)
  return NextResponse.json(grant, { headers: NO_STORE })
}
