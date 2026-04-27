import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { updateMemoryFactSchema } from "@/lib/validators"
import { getMemoryFact, updateMemoryFact, softDeleteMemoryFact } from "@/lib/ai/memory/memory-service"

export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store" }

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "未登录" }, { status: 401, headers: NO_STORE })

  const { id } = await params
  const fact = await getMemoryFact(session.userId, id)
  if (!fact) return NextResponse.json({ error: "未找到" }, { status: 404, headers: NO_STORE })

  return NextResponse.json(fact, { headers: NO_STORE })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "未登录" }, { status: 401, headers: NO_STORE })

  const { id } = await params
  const body = await req.json().catch(() => null)
  const parsed = updateMemoryFactSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "参数错误", detail: parsed.error.flatten() }, { status: 400, headers: NO_STORE })
  }

  const result = await updateMemoryFact(session.userId, id, parsed.data)
  if (!result.ok) {
    const status = result.reason === "not_found" ? 404 : 400
    return NextResponse.json({ error: result.reason ?? "更新失败" }, { status, headers: NO_STORE })
  }

  return NextResponse.json({ id: result.id, ok: true }, { headers: NO_STORE })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "未登录" }, { status: 401, headers: NO_STORE })

  const { id } = await params
  const deleted = await softDeleteMemoryFact(session.userId, id)
  if (!deleted) return NextResponse.json({ error: "未找到或已被删除" }, { status: 404, headers: NO_STORE })

  return NextResponse.json({ deleted: true, id }, { headers: NO_STORE })
}
