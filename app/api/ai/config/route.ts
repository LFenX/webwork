import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { getAIUserConfig, removeAIUserConfig, upsertAIUserConfig } from "@/lib/ai/service"
import { aiProviderConfigSchema, aiProviderConfigUpdateSchema } from "@/lib/validators"

export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store" }

export async function GET() {
  const session = await requireAuth()
  const config = await getAIUserConfig(session.userId)
  return NextResponse.json({
    config: config
      ? {
          providerLabel: config.providerLabel,
          baseUrl: config.baseUrl,
          model: config.model,
          temperature: config.temperature,
          streamEnabled: config.streamEnabled,
          isEnabled: config.isEnabled,
          apiKeyMask: config.apiKeyMask,
          lastTestStatus: config.lastTestStatus,
          lastTestedAt: config.lastTestedAt?.toISOString() ?? null,
        }
      : null,
  }, { headers: NO_STORE })
}

export async function PUT(req: NextRequest) {
  const session = await requireAuth()
  const body = await req.json().catch(() => null)
  const parsed = aiProviderConfigSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400, headers: NO_STORE })
  }
  const config = await upsertAIUserConfig(session.userId, parsed.data)
  return NextResponse.json({
    config: {
      id: config.id,
      providerLabel: config.providerLabel,
      baseUrl: config.baseUrl,
      model: config.model,
      temperature: config.temperature,
      streamEnabled: config.streamEnabled,
      isEnabled: config.isEnabled,
      apiKeyMask: config.apiKeyMask,
    },
  }, { headers: NO_STORE })
}

export async function PATCH(req: NextRequest) {
  const session = await requireAuth()
  const body = await req.json().catch(() => null)
  const parsed = aiProviderConfigUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400, headers: NO_STORE })
  }
  const config = await upsertAIUserConfig(session.userId, parsed.data)
  return NextResponse.json({
    config: {
      id: config.id,
      providerLabel: config.providerLabel,
      baseUrl: config.baseUrl,
      model: config.model,
      temperature: config.temperature,
      streamEnabled: config.streamEnabled,
      isEnabled: config.isEnabled,
      apiKeyMask: config.apiKeyMask,
    },
  }, { headers: NO_STORE })
}

export async function DELETE() {
  const session = await requireAuth()
  await removeAIUserConfig(session.userId)
  return NextResponse.json({ success: true }, { headers: NO_STORE })
}
