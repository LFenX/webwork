import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { getAIStatusSnapshot, getMyAIAccessRequest, getAIUserConfig } from "@/lib/ai/service"

export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store" }

export async function GET() {
  const session = await requireAuth()
  const [status, request, userConfig] = await Promise.all([
    getAIStatusSnapshot(session.userId),
    getMyAIAccessRequest(session.userId),
    getAIUserConfig(session.userId),
  ])
  return NextResponse.json({
    status,
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
    userConfig: userConfig
      ? {
          id: userConfig.id,
          providerLabel: userConfig.providerLabel,
          baseUrl: userConfig.baseUrl,
          model: userConfig.model,
          temperature: userConfig.temperature,
          streamEnabled: userConfig.streamEnabled,
          isEnabled: userConfig.isEnabled,
          apiKeyMask: userConfig.apiKeyMask,
          lastTestStatus: userConfig.lastTestStatus,
          lastTestedAt: userConfig.lastTestedAt?.toISOString() ?? null,
        }
      : null,
  }, { headers: NO_STORE })
}
