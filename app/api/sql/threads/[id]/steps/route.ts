import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { jsonError } from "@/lib/sql-lab/service"
import { appendThreadStep } from "@/lib/sql-lab/threads"
import type { SqlThreadStepKind, SqlThreadStepStatus } from "@/lib/sql-lab/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const NO_STORE = { "Cache-Control": "no-store" } as const

const ALLOWED_MANUAL_KINDS: SqlThreadStepKind[] = ["user_prompt", "user_note"]

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth()
    const { id } = await ctx.params
    const body = await req.json().catch(() => ({})) as {
      kind?: SqlThreadStepKind
      title?: string
      bodyMarkdown?: string
      payload?: unknown
      status?: SqlThreadStepStatus
    }
    const kind = body.kind ?? "user_note"
    if (!ALLOWED_MANUAL_KINDS.includes(kind)) {
      return NextResponse.json({ error: "该步骤类型不可手动追加" }, { status: 400, headers: NO_STORE })
    }
    const step = await appendThreadStep(session.userId, {
      threadId: id,
      kind,
      title: body.title ?? "",
      bodyMarkdown: body.bodyMarkdown ?? "",
      payload: body.payload,
      status: body.status ?? "done",
    })
    return NextResponse.json(step, { headers: NO_STORE })
  } catch (error) {
    return jsonError(error)
  }
}
