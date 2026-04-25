import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { getAIUserConfigById, setActiveAIUserConfig } from "@/lib/ai/service"

export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store" }

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await requireAuth()
  const config = await getAIUserConfigById(id)
  if (!config || config.userId !== session.userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE })
  }
  await setActiveAIUserConfig(id)
  return NextResponse.json({ success: true }, { headers: NO_STORE })
}
