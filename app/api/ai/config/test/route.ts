import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { markAIUserConfigTest, testAIProviderConnection } from "@/lib/ai/service"
import { aiProviderConfigSchema } from "@/lib/validators"

export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store" }

export async function POST(req: NextRequest) {
  const session = await requireAuth()
  const body = await req.json().catch(() => null)
  const parsed = aiProviderConfigSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400, headers: NO_STORE })
  }
  try {
    await testAIProviderConnection(parsed.data)
    await markAIUserConfigTest(session.userId, "passed")
    return NextResponse.json({ success: true }, { headers: NO_STORE })
  } catch (error) {
    await markAIUserConfigTest(session.userId, "failed")
    return NextResponse.json({ error: error instanceof Error ? error.message : "Connection failed" }, { status: 400, headers: NO_STORE })
  }
}
