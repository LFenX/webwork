import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { withProviderCapabilities } from "@/lib/ai/provider"
import { createAIUserConfig, deleteAIUserConfig, getActiveUserConfig, getAIUserConfigs } from "@/lib/ai/service"
import { aiProviderConfigSchema } from "@/lib/validators"

export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store" }

export async function GET() {
  const session = await requireAuth()
  const config = await getActiveUserConfig(session.userId)
  return NextResponse.json({
    config: config
      ? withProviderCapabilities({
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
          lastTestStatus: config.lastTestStatus,
          lastTestedAt: config.lastTestedAt?.toISOString() ?? null,
        })
      : null,
  }, { headers: NO_STORE })
}

export async function PUT(req: NextRequest) {
  try {
    const session = await requireAuth()
    const body = await req.json().catch(() => null)
    if (!body?.name?.trim()) {
      return NextResponse.json({ error: "配置名称不能为空" }, { status: 400, headers: NO_STORE })
    }
    const parsed = aiProviderConfigSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400, headers: NO_STORE })
    }
    const config = await createAIUserConfig(session.userId, parsed.data)
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
      { error: error instanceof Error ? error.message : "Failed to save AI config" },
      { status: 503, headers: NO_STORE }
    )
  }
}

export async function DELETE() {
  const session = await requireAuth()
  const configs = await getAIUserConfigs(session.userId)
  for (const c of configs) {
    await deleteAIUserConfig(c.id)
  }
  return NextResponse.json({ success: true }, { headers: NO_STORE })
}
