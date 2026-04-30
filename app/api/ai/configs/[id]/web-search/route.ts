import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { getAIUserConfigById } from "@/lib/ai/service"
import { getSafeWebSearchConfig, upsertWebSearchConfig } from "@/lib/web-search/credential-service"
import { aiWebSearchConfigSchema } from "@/lib/validators"

export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store" }

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await requireAuth()
  const config = await getAIUserConfigById(id)
  if (!config || config.userId !== session.userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE })
  }
  const webSearch = await getSafeWebSearchConfig("USER_CONFIG", id)
  return NextResponse.json({ webSearch }, { headers: NO_STORE })
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await requireAuth()
  const config = await getAIUserConfigById(id)
  if (!config || config.userId !== session.userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE })
  }
  const body = await req.json().catch(() => null)
  const parsed = aiWebSearchConfigSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400, headers: NO_STORE })
  }
  const webSearch = await upsertWebSearchConfig("USER_CONFIG", id, {
    ...parsed.data,
  })
  return NextResponse.json({ webSearch }, { headers: NO_STORE })
}
