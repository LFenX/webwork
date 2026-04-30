import "server-only"
import { Prisma } from "@/app/generated/prisma/client"
import { decryptSecret, encryptSecret, maskApiKey } from "@/lib/ai/crypto"
import { getActiveUserConfig } from "@/lib/ai/service"
import { prisma } from "@/lib/db"
import type { ResolvedWebSearchCredential, WebSearchCredentialSource } from "@/lib/web-search/types"

export const WEB_SEARCH_PROVIDER = "aliyun"
export const WEB_SEARCH_DEFAULT_HOST = "http://default-486s.platform-cn-shanghai.opensearch.aliyuncs.com"
export const WEB_SEARCH_DEFAULT_WORKSPACE = "default"
export const WEB_SEARCH_DEFAULT_SERVICE_ID = "ops-web-search-001"

export type WebSearchConfigInput = {
  enabled?: boolean
  apiKey?: string
  host?: string
  workspace?: string
  serviceId?: string
}

function normalizeHost(host: string) {
  return host.trim().replace(/\/+$/, "")
}

function safeWebSearchConfig(config: {
  id: string
  ownerType: string
  ownerId: string
  provider: string
  enabled: boolean
  apiKeyMask: string
  host: string
  workspace: string
  serviceId: string
  updatedAt: Date
} | null) {
  if (!config) {
    return {
      provider: WEB_SEARCH_PROVIDER,
      enabled: false,
      configured: false,
      apiKeyMask: "",
      host: "",
      workspace: WEB_SEARCH_DEFAULT_WORKSPACE,
      serviceId: WEB_SEARCH_DEFAULT_SERVICE_ID,
      updatedAt: null,
    }
  }
  return {
    id: config.id,
    ownerType: config.ownerType,
    ownerId: config.ownerId,
    provider: config.provider,
    enabled: config.enabled,
    configured: Boolean(config.apiKeyMask),
    apiKeyMask: config.apiKeyMask,
    host: config.host,
    workspace: config.workspace,
    serviceId: config.serviceId,
    updatedAt: config.updatedAt.toISOString(),
  }
}

export async function getSafeWebSearchConfig(ownerType: WebSearchCredentialSource, ownerId: string) {
  const config = await prisma.aIWebSearchConfig.findUnique({
    where: { ownerType_ownerId: { ownerType, ownerId } },
  })
  return safeWebSearchConfig(config)
}

export async function upsertWebSearchConfig(ownerType: WebSearchCredentialSource, ownerId: string, input: WebSearchConfigInput) {
  const apiKey = typeof input.apiKey === "string" ? input.apiKey.trim() : ""
  const data: Prisma.AIWebSearchConfigUncheckedUpdateInput = {
    provider: WEB_SEARCH_PROVIDER,
  }

  if (input.enabled !== undefined) data.enabled = input.enabled
  if (input.host !== undefined) data.host = normalizeHost(input.host)
  if (input.workspace !== undefined) data.workspace = input.workspace.trim() || WEB_SEARCH_DEFAULT_WORKSPACE
  if (input.serviceId !== undefined) data.serviceId = input.serviceId.trim() || WEB_SEARCH_DEFAULT_SERVICE_ID
  if (apiKey) {
    data.apiKeyEncrypted = encryptSecret(apiKey)
    data.apiKeyMask = maskApiKey(apiKey)
  }

  const createData: Prisma.AIWebSearchConfigUncheckedCreateInput = {
    ownerType,
    ownerId,
    provider: WEB_SEARCH_PROVIDER,
    enabled: input.enabled ?? false,
    apiKeyEncrypted: apiKey ? encryptSecret(apiKey) : "",
    apiKeyMask: apiKey ? maskApiKey(apiKey) : "",
    host: normalizeHost(input.host ?? WEB_SEARCH_DEFAULT_HOST),
    workspace: input.workspace?.trim() || WEB_SEARCH_DEFAULT_WORKSPACE,
    serviceId: input.serviceId?.trim() || WEB_SEARCH_DEFAULT_SERVICE_ID,
  }

  const config = await prisma.aIWebSearchConfig.upsert({
    where: { ownerType_ownerId: { ownerType, ownerId } },
    create: createData,
    update: data,
  })
  return safeWebSearchConfig(config)
}

export async function resolveWebSearchCredential(userId: string): Promise<ResolvedWebSearchCredential> {
  const activeConfig = await getActiveUserConfig(userId)
  if (activeConfig && activeConfig.isEnabled && activeConfig.apiKeyEncrypted) {
    const config = await prisma.aIWebSearchConfig.findUnique({
      where: { ownerType_ownerId: { ownerType: "USER_CONFIG", ownerId: activeConfig.id } },
    })
    if (!config?.enabled || !config.apiKeyEncrypted) {
      return {
        ok: false,
        source: "USER_CONFIG",
        ownerId: activeConfig.id,
        message: "你当前使用的是自己的模型配置，因此需要先配置自己的阿里联网搜索 API。",
      }
    }
    return {
      ok: true,
      source: "USER_CONFIG",
      ownerId: activeConfig.id,
      credential: {
        apiKey: decryptSecret(config.apiKeyEncrypted),
        host: config.host,
        workspace: config.workspace,
        serviceId: config.serviceId,
      },
    }
  }

  const grant = await prisma.aIUsageGrant.findUnique({ where: { userId } })
  if (grant?.status === "active" && grant.apiKeyEncrypted) {
    if (!grant.webSearchEnabled) {
      return {
        ok: false,
        source: "ADMIN_GRANT",
        ownerId: grant.id,
        message: "当前管理员授权未开放联网搜索能力。",
      }
    }
    const config = await prisma.aIWebSearchConfig.findUnique({
      where: { ownerType_ownerId: { ownerType: "ADMIN_GRANT", ownerId: grant.id } },
    })
    if (!config?.enabled || !config.apiKeyEncrypted) {
      return {
        ok: false,
        source: "ADMIN_GRANT",
        ownerId: grant.id,
        message: "管理员尚未完成联网搜索配置。",
      }
    }
    return {
      ok: true,
      source: "ADMIN_GRANT",
      ownerId: grant.id,
      credential: {
        apiKey: decryptSecret(config.apiKeyEncrypted),
        host: config.host,
        workspace: config.workspace,
        serviceId: config.serviceId,
      },
    }
  }

  return { ok: false, message: "当前账号没有可用的 AI 配置。" }
}
