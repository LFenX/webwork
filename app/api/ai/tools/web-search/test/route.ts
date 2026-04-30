import { NextRequest, NextResponse } from "next/server"
import { requireAdminPermission } from "@/lib/admin"
import { requireAuth } from "@/lib/auth"
import { getAIUserConfigById } from "@/lib/ai/service"
import { decryptSecret } from "@/lib/ai/crypto"
import { prisma } from "@/lib/db"
import { aliyunWebSearch } from "@/lib/web-search/aliyun-web-search-provider"
import { resolveWebSearchCredential } from "@/lib/web-search/credential-service"
import { aiWebSearchTestSchema } from "@/lib/validators"

export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store" }

export async function POST(req: NextRequest) {
  const session = await requireAuth()
  const body = await req.json().catch(() => null)
  const parsed = aiWebSearchTestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400, headers: NO_STORE })
  }

  const { query, maxResults, contentType, configId, adminGrantUserId, webSearch } = parsed.data

  try {
    if (adminGrantUserId) {
      await requireAdminPermission("manageAI")
      const grant = await prisma.aIUsageGrant.findUnique({ where: { userId: adminGrantUserId } })
      if (!grant) return NextResponse.json({ error: "Grant not found" }, { status: 404, headers: NO_STORE })
      if (!grant.webSearchEnabled && !webSearch?.enabled) {
        return NextResponse.json({ error: "当前管理员授权未开放联网搜索能力。" }, { status: 403, headers: NO_STORE })
      }
      const saved = await prisma.aIWebSearchConfig.findUnique({
        where: { ownerType_ownerId: { ownerType: "ADMIN_GRANT", ownerId: grant.id } },
      })
      const apiKey = webSearch?.apiKey?.trim()
        || (saved?.apiKeyEncrypted ? decryptSecret(saved.apiKeyEncrypted) : "")
      const result = await aliyunWebSearch({
        query,
        maxResults,
        contentType,
        credential: {
          apiKey,
          host: webSearch?.host || saved?.host || "",
          workspace: webSearch?.workspace || saved?.workspace || "default",
          serviceId: webSearch?.serviceId || saved?.serviceId || "ops-web-search-001",
        },
      })
      return NextResponse.json({ result }, { headers: NO_STORE })
    }

    if (configId) {
      const config = await getAIUserConfigById(configId)
      if (!config || config.userId !== session.userId) {
        return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE })
      }
    }

    const resolved = await resolveWebSearchCredential(session.userId)
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.message }, { status: 403, headers: NO_STORE })
    }
    const result = await aliyunWebSearch({
      query,
      maxResults,
      contentType,
      credential: {
        apiKey: webSearch?.apiKey?.trim() || resolved.credential.apiKey,
        host: webSearch?.host || resolved.credential.host,
        workspace: webSearch?.workspace || resolved.credential.workspace,
        serviceId: webSearch?.serviceId || resolved.credential.serviceId,
      },
    })
    return NextResponse.json({ result }, { headers: NO_STORE })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Web search test failed" },
      { status: 500, headers: NO_STORE },
    )
  }
}
