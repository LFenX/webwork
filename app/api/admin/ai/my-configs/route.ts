import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { requireAdminPermission } from "@/lib/admin"
import { decryptSecret } from "@/lib/ai/crypto"

export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store" }

export async function GET() {
  try {
    const admin = await requireAdminPermission("manageAI")

    const configs = await prisma.aIUserProviderConfig.findMany({
      where: { userId: admin.id },
      orderBy: { updatedAt: "desc" },
    })

    return NextResponse.json({
      configs: configs.map((c) => {
        let apiKey = ""
        try {
          apiKey = c.apiKeyEncrypted ? decryptSecret(c.apiKeyEncrypted) : ""
        } catch {
          // Key can't be decrypted — return empty
        }

        let modelList: string[] = []
        try {
          const parsed = JSON.parse(c.modelList)
          if (Array.isArray(parsed)) modelList = parsed.filter((v): v is string => typeof v === "string" && v.trim().length > 0)
        } catch { /* ignore */ }

        return {
          id: c.id,
          name: c.name,
          providerLabel: c.providerLabel,
          baseUrl: c.baseUrl,
          apiKey,
          apiKeyMask: c.apiKeyMask,
          model: c.model,
          modelList,
          temperature: c.temperature,
          streamEnabled: c.streamEnabled,
          isEnabled: c.isEnabled,
          lastTestStatus: c.lastTestStatus,
          lastTestedAt: c.lastTestedAt?.toISOString() ?? null,
        }
      }),
    }, { headers: NO_STORE })
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: NO_STORE })
  }
}
