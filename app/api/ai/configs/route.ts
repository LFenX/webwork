import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { withProviderCapabilities } from "@/lib/ai/provider"
import { createAIUserConfig, getAIUserConfigs } from "@/lib/ai/service"
import { aiProviderConfigSchema } from "@/lib/validators"

export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store" }

export async function GET() {
  const session = await requireAuth()
  const configs = await getAIUserConfigs(session.userId)
  return NextResponse.json({ configs }, { headers: NO_STORE })
}

export async function POST(req: NextRequest) {
  const session = await requireAuth()
  const body = await req.json().catch(() => null)
  const parsed = aiProviderConfigSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400, headers: NO_STORE })
  }
  if (!parsed.data.name?.trim()) {
    return NextResponse.json({ error: "配置名称不能为空" }, { status: 400, headers: NO_STORE })
  }
  try {
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
