import { NextResponse } from "next/server"
import { Prisma } from "@/app/generated/prisma/client"
import { requireAuth } from "@/lib/auth"
import { getAIStatusSnapshot, getMyAIAccessRequest, getAIUnifiedConfigs } from "@/lib/ai/service"
import { withProviderCapabilities } from "@/lib/ai/provider"

export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store" }

export async function GET() {
  const session = await requireAuth()
  const [status, request, unified] = await Promise.all([
    getAIStatusSnapshot(session.userId),
    getMyAIAccessRequest(session.userId),
    getAIUnifiedConfigs(session.userId),
  ])

  const allConfigs = [...unified.selfConfigs, ...unified.grantConfigs]
  const activeConfig = allConfigs.find((c) => c.isActive) ?? null

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
          source: activeConfig.source,
          name: activeConfig.name,
          isActive: activeConfig.isActive,
          providerLabel: activeConfig.providerLabel,
          baseUrl: activeConfig.baseUrl,
          model: activeConfig.model,
          modelList: activeConfig.modelList,
          temperature: activeConfig.temperature,
          streamEnabled: activeConfig.streamEnabled,
          capabilities: status.config?.capabilities ?? withProviderCapabilities(activeConfig).capabilities,
          isEnabled: activeConfig.isEnabled,
          apiKeyMask: activeConfig.apiKeyMask,
          status: activeConfig.status,
          lastTestStatus: activeConfig.lastTestStatus,
          lastTestedAt: activeConfig.lastTestedAt ?? null,
        }
      : null,
    userConfigs: allConfigs.map((c) => ({
      id: c.id,
      source: c.source,
      name: c.name,
      isActive: c.isActive,
      providerLabel: c.providerLabel,
      baseUrl: c.baseUrl,
      model: c.model,
      modelList: c.modelList,
      temperature: c.temperature,
      streamEnabled: c.streamEnabled,
      isEnabled: c.isEnabled,
      apiKeyMask: c.apiKeyMask,
      status: c.status,
      lastTestStatus: c.lastTestStatus,
      lastTestedAt: c.lastTestedAt ?? null,
      grantedByAdminId: c.grantedByAdminId,
    })),
  }, { headers: NO_STORE })
}
