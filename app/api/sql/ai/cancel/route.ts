import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { cancelActiveSql, jsonError } from "@/lib/sql-lab/service"
import { setThreadStatus, updateThreadStep } from "@/lib/sql-lab/threads"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const NO_STORE = { "Cache-Control": "no-store" } as const

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth()
    const body = (await req.json().catch(() => ({}))) as { threadId?: string; stepId?: string }
    if (!body.threadId) {
      return NextResponse.json({ error: "缺少 threadId" }, { status: 400, headers: NO_STORE })
    }
    const result = await cancelActiveSql(session.userId, body.threadId)
    if (body.stepId) {
      await updateThreadStep(session.userId, {
        stepId: body.stepId,
        status: "aborted",
        title: "已叫停",
        bodyMarkdown: "用户已叫停本次 AI 分析。",
        errorMessage: "aborted",
      }).catch(() => undefined)
    }
    await setThreadStatus(body.threadId, "idle").catch(() => undefined)
    return NextResponse.json(result, { headers: NO_STORE })
  } catch (error) {
    return jsonError(error)
  }
}
