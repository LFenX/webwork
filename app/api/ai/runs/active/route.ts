import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { listActiveAIRuns } from "@/lib/ai/service"

export const dynamic = "force-dynamic"

const NO_STORE = { "Cache-Control": "no-store" }

// Currently-running (or cancelling) runs for the user, across all conversations.
// Powers the global "running task" indicator that lets the user jump back to a
// task from any conversation.
export async function GET() {
  const session = await requireAuth()
  const runs = await listActiveAIRuns(session.userId)
  return NextResponse.json({ runs }, { headers: NO_STORE })
}
