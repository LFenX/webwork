import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { getAIStatusSnapshot, getMyAIAccessRequest, getAIUserConfigs } from "@/lib/ai/service"
import { withProviderCapabilities } from "@/lib/ai/provider"

export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store" }

export async function GET() {
  const session = await requireAuth()
  const [status, request, configs] = await Promise.all([
    getAIStatusSnapshot(session.userId),
    getMyAIAccessRequest(session.userId),
    getAIUserConfigs(session.userId),
  ])

  const activeConfig = configs.find((c) => c.isActive) ?? null

  return NextResponse.json({
    status,
    storageReady: status.configState.storageReady,
    accessRequest: request
      ? {
          id: request.id,
          status: request.status,
          message: request.message,
          reviewNote: request.reviewNote,
          createdAt: request.createdAt.toISOString(),
          reviewedAt: request.reviewedAt?.toISOString() ?? null,
        }
      : null,
    userConfig: activeConfig
      ? {
          id: activeConfig.id,
          name: activeConfig.name,
          isActive: activeConfig.isActive,
          providerLabel: activeConfig.providerLabel,
          baseUrl: activeConfig.baseUrl,
          model: activeConfig.model,
          temperature: activeConfig.temperature,
          streamEnabled: activeConfig.streamEnabled,
          capabilities: status.config?.capabilities ?? withProviderCapabilities(activeConfig).capabilities,
          isEnabled: activeConfig.isEnabled,
          apiKeyMask: activeConfig.apiKeyMask,
          lastTestStatus: activeConfig.lastTestStatus,
          lastTestedAt: activeConfig.lastTestedAt?.toISOString() ?? null,
        }
      : null,
    userConfigs: configs.map((c) => ({
      id: c.id,
      name: c.name,
      isActive: c.isActive,
      providerLabel: c.providerLabel,
      baseUrl: c.baseUrl,
      model: c.model,
      temperature: c.temperature,
      streamEnabled: c.streamEnabled,
      isEnabled: c.isEnabled,
      apiKeyMask: c.apiKeyMask,
      lastTestStatus: c.lastTestStatus,
      lastTestedAt: c.lastTestedAt?.toISOString() ?? null,
    })),
  }, { headers: NO_STORE })
}
