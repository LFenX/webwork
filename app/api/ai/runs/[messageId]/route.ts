import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { getAIRunByMessageId } from "@/lib/ai/service"
import { aiRunsQuerySchema } from "@/lib/validators"

export const dynamic = "force-dynamic"

const NO_STORE = { "Cache-Control": "no-store" }

export async function GET(req: NextRequest, { params }: { params: Promise<{ messageId: string }> }) {
  const session = await requireAuth()
  const { messageId } = await params
  const query = Object.fromEntries(req.nextUrl.searchParams.entries())
  const parsed = aiRunsQuerySchema.safeParse(query)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400, headers: NO_STORE })
  }

  const run = await getAIRunByMessageId(session.userId, messageId, parsed.data.includeSteps)
  if (!run) {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE })
  }

  return NextResponse.json({ run }, { headers: NO_STORE })
}
