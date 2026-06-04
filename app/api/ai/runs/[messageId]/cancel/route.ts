import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { requestAIRunCancellation } from "@/lib/ai/service"

export const dynamic = "force-dynamic"

const NO_STORE = { "Cache-Control": "no-store" }

// Server-side cancel: flags the run as cancelling so the agent loop stops at its
// next checkpoint (each round, before/after each tool call, before LaTeX
// compile). Unlike aborting the client fetch, this actually stops generation.
export async function POST(_req: Request, { params }: { params: Promise<{ messageId: string }> }) {
  const session = await requireAuth()
  const { messageId } = await params

  const result = await requestAIRunCancellation(session.userId, messageId)
  if (!result.runId) {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE })
  }

  return NextResponse.json(
    { ok: true, runId: result.runId, alreadyFinished: result.alreadyFinished },
    { headers: NO_STORE },
  )
}
