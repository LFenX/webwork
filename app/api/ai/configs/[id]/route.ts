import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { withProviderCapabilities } from "@/lib/ai/provider"
import { deleteAIUserConfig, getAIUserConfigById, updateAIUserConfig } from "@/lib/ai/service"
import { aiProviderConfigUpdateSchema } from "@/lib/validators"

export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store" }

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await requireAuth()
  const config = await getAIUserConfigById(id)
  if (!config || config.userId !== session.userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE })
  }
  return NextResponse.json({
    config: {
      id: config.id,
      name: config.name,
      isActive: config.isActive,
      providerLabel: config.providerLabel,
      baseUrl: config.baseUrl,
      model: config.model,
      temperature: config.temperature,
      streamEnabled: config.streamEnabled,
      isEnabled: config.isEnabled,
      apiKeyMask: config.apiKeyMask,
      lastTestedAt: config.lastTestedAt?.toISOString() ?? null,
      lastTestStatus: config.lastTestStatus,
    },
  }, { headers: NO_STORE })
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await requireAuth()
  const existing = await getAIUserConfigById(id)
  if (!existing || existing.userId !== session.userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE })
  }
  const body = await req.json().catch(() => null)
  const parsed = aiProviderConfigUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400, headers: NO_STORE })
  }
  try {
    const config = await updateAIUserConfig(id, parsed.data)
    return NextResponse.json({
      config: withProviderCapabilities({
        id: config.id,
        name: config.name,
        isActive: config.isActive,
        providerLabel: config.providerLabel,
        baseUrl: config.baseUrl,
        model: config.model,
        temperature: config.temperature,
        streamEnabled: config.streamEnabled,
        isEnabled: config.isEnabled,
        apiKeyMask: config.apiKeyMask,
      }),
    }, { headers: NO_STORE })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update AI config" },
      { status: 503, headers: NO_STORE }
    )
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await requireAuth()
  const existing = await getAIUserConfigById(id)
  if (!existing || existing.userId !== session.userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE })
  }
  try {
    await deleteAIUserConfig(id)
    return NextResponse.json({ success: true }, { headers: NO_STORE })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete AI config" },
      { status: 503, headers: NO_STORE }
    )
  }
}
