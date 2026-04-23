import "server-only"
import { Prisma } from "@/app/generated/prisma/client"
import { decryptSecret, encryptSecret, maskApiKey } from "@/lib/ai/crypto"
import { prisma } from "@/lib/db"
import { AI_TOOL_DESCRIPTORS } from "@/lib/ai/tools/registry"
import type {
  AIConversationHistoryEntry,
  AIConversationListItem,
  AIMessageItem,
  AIResolvedProviderConfig,
  AISafeProviderConfig,
  AIStatusSnapshot,
} from "@/lib/ai/types"
import type {
  AIAccessRequestInput,
  AIConversationCreateInput,
  AIConversationUpdateInput,
  AIGrantInput,
  AIProviderConfigInput,
  AIProviderConfigUpdateInput,
} from "@/lib/validators"

function toSafeConfig(value: {
  providerLabel: string
  baseUrl: string
  model: string
  temperature: number
  streamEnabled: boolean
}): AISafeProviderConfig {
  return {
    providerLabel: value.providerLabel,
    baseUrl: value.baseUrl,
    model: value.model,
    temperature: value.temperature,
    streamEnabled: value.streamEnabled,
  }
}

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.trim().replace(/\/+$/, "")
}

function buildConversationTitle(prompt: string) {
  return prompt.trim().replace(/\s+/g, " ").slice(0, 60) || "新会话"
}

function isDefaultConversationTitle(title: string) {
  return ["New conversation", "新会话", ""].includes(title.trim())
}

export async function getAIStatusSnapshot(userId: string): Promise<AIStatusSnapshot> {
  const [userConfig, grant, latestRequest] = await Promise.all([
    prisma.aIUserProviderConfig.findUnique({ where: { userId } }),
    prisma.aIUsageGrant.findUnique({ where: { userId } }),
    prisma.aIAccessRequest.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
    }),
  ])

  if (userConfig && userConfig.isEnabled && userConfig.apiKeyEncrypted) {
    return {
      canUseAI: true,
      source: "user",
      reason: "ready",
      config: toSafeConfig(userConfig),
      configState: {
        hasUserConfig: true,
        userConfigEnabled: true,
        hasGrant: Boolean(grant),
        grantStatus: grant?.status ?? null,
        accessRequestStatus: latestRequest?.status ?? null,
      },
    }
  }

  if (grant?.status === "active" && grant.apiKeyEncrypted) {
    return {
      canUseAI: true,
      source: "grant",
      reason: "ready",
      config: toSafeConfig(grant),
      configState: {
        hasUserConfig: Boolean(userConfig),
        userConfigEnabled: Boolean(userConfig?.isEnabled),
        hasGrant: true,
        grantStatus: grant.status,
        accessRequestStatus: latestRequest?.status ?? null,
      },
    }
  }

  let reason: AIStatusSnapshot["reason"] = "configure-personal-api"
  if (latestRequest?.status === "pending") reason = "request-pending"
  else if (latestRequest?.status === "rejected") reason = "request-rejected"
  else if (grant?.status === "paused") reason = "grant-paused"
  else if (grant?.status === "revoked") reason = "grant-revoked"
  else if (!userConfig && !grant) reason = "request-access"

  return {
    canUseAI: false,
    source: "none",
    reason,
    config: null,
    configState: {
      hasUserConfig: Boolean(userConfig),
      userConfigEnabled: Boolean(userConfig?.isEnabled),
      hasGrant: Boolean(grant),
      grantStatus: grant?.status ?? null,
      accessRequestStatus: latestRequest?.status ?? null,
    },
  }
}

export async function getEffectiveProviderConfig(userId: string): Promise<AIResolvedProviderConfig | null> {
  const status = await getAIStatusSnapshot(userId)
  if (!status.canUseAI || !status.config) return null

  if (status.source === "user") {
    const config = await prisma.aIUserProviderConfig.findUnique({ where: { userId } })
    if (!config?.apiKeyEncrypted) return null
    return {
      ...toSafeConfig(config),
      source: "user",
      apiKey: decryptSecret(config.apiKeyEncrypted),
    }
  }

  const grant = await prisma.aIUsageGrant.findUnique({ where: { userId } })
  if (!grant?.apiKeyEncrypted || grant.status !== "active") return null
  return {
    ...toSafeConfig(grant),
    source: "grant",
    apiKey: decryptSecret(grant.apiKeyEncrypted),
  }
}

export async function getEffectiveProviderSecret(userId: string) {
  const config = await getEffectiveProviderConfig(userId)
  return config?.apiKey ?? null
}

export async function listAIConversations(userId: string): Promise<AIConversationListItem[]> {
  const items = await prisma.aIConversation.findMany({
    where: { userId, deletedAt: null },
    orderBy: [{ lastMessageAt: "desc" }, { updatedAt: "desc" }],
    include: { _count: { select: { messages: true } } },
  })

  return items.map((item) => ({
    id: item.id,
    title: item.title,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
    lastMessageAt: item.lastMessageAt.toISOString(),
    messageCount: item._count.messages,
  }))
}

export async function createAIConversation(userId: string, input: AIConversationCreateInput) {
  return prisma.aIConversation.create({
    data: {
      userId,
      title: input.title?.trim() || "新会话",
    },
  })
}

export async function getAIConversationOrThrow(userId: string, conversationId: string) {
  const conversation = await prisma.aIConversation.findFirst({
    where: { id: conversationId, userId, deletedAt: null },
  })
  if (!conversation) throw new Error("NOT_FOUND")
  return conversation
}

export async function updateAIConversation(userId: string, conversationId: string, input: AIConversationUpdateInput) {
  await getAIConversationOrThrow(userId, conversationId)
  return prisma.aIConversation.update({
    where: { id: conversationId },
    data: { title: input.title.trim() },
  })
}

export async function updateAIConversationTitleIfNeeded(userId: string, conversationId: string, prompt: string) {
  const conversation = await getAIConversationOrThrow(userId, conversationId)
  if (!isDefaultConversationTitle(conversation.title)) return conversation

  return prisma.aIConversation.update({
    where: { id: conversationId },
    data: { title: buildConversationTitle(prompt) },
  })
}

export async function deleteAIConversation(userId: string, conversationId: string) {
  await getAIConversationOrThrow(userId, conversationId)
  return prisma.aIConversation.update({
    where: { id: conversationId },
    data: { deletedAt: new Date() },
  })
}

export async function listAIConversationMessages(userId: string, conversationId: string): Promise<AIMessageItem[]> {
  await getAIConversationOrThrow(userId, conversationId)
  const items = await prisma.aIMessage.findMany({
    where: { userId, conversationId },
    orderBy: { createdAt: "asc" },
  })

  return items.map((item) => ({
    id: item.id,
    role: item.role,
    contentMarkdown: item.contentMarkdown,
    status: item.status,
    reasoningSummary: item.reasoningSummary,
    toolTraceSummary: item.toolTraceSummary,
    modelName: item.modelName,
    providerSource: item.providerSource as AIMessageItem["providerSource"],
    createdAt: item.createdAt.toISOString(),
  }))
}

export async function listRecentConversationHistory(userId: string, conversationId: string, limit = 12): Promise<AIConversationHistoryEntry[]> {
  await getAIConversationOrThrow(userId, conversationId)
  const items = await prisma.aIMessage.findMany({
    where: { userId, conversationId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      role: true,
      contentMarkdown: true,
    },
  })

  return items
    .reverse()
    .filter((item) => item.contentMarkdown.trim())
    .map((item) => ({
      role: item.role as AIConversationHistoryEntry["role"],
      content: item.contentMarkdown,
    }))
}

export async function getAIUserConfig(userId: string) {
  return prisma.aIUserProviderConfig.findUnique({ where: { userId } })
}

export async function upsertAIUserConfig(userId: string, input: AIProviderConfigInput | AIProviderConfigUpdateInput) {
  const apiKey = typeof input.apiKey === "string" ? input.apiKey.trim() : undefined
  const encryptedApiKey = apiKey ? encryptSecret(apiKey) : undefined
  const data = {
    providerType: "openai-compatible",
    ...(input.providerLabel !== undefined ? { providerLabel: input.providerLabel.trim() } : {}),
    ...(input.baseUrl !== undefined ? { baseUrl: normalizeBaseUrl(input.baseUrl) } : {}),
    ...(input.model !== undefined ? { model: input.model.trim() } : {}),
    ...(input.temperature !== undefined ? { temperature: input.temperature } : {}),
    ...(input.streamEnabled !== undefined ? { streamEnabled: input.streamEnabled } : {}),
    ...(input.isEnabled !== undefined ? { isEnabled: input.isEnabled } : {}),
    ...(encryptedApiKey ? { apiKeyEncrypted: encryptedApiKey, apiKeyMask: maskApiKey(apiKey!) } : {}),
  }

  const config = await prisma.aIUserProviderConfig.upsert({
    where: { userId },
    update: data,
    create: {
      userId,
      providerType: "openai-compatible",
      providerLabel: input.providerLabel?.trim() || "OpenAI-compatible",
      baseUrl: input.baseUrl ? normalizeBaseUrl(input.baseUrl) : "",
      model: input.model?.trim() || "",
      temperature: input.temperature ?? 0.7,
      streamEnabled: input.streamEnabled ?? true,
      isEnabled: input.isEnabled ?? true,
      apiKeyEncrypted: encryptedApiKey || "",
      apiKeyMask: apiKey ? maskApiKey(apiKey) : "",
    },
  })

  await createAIAuditLog(userId, userId, "ai_user_config_updated", "Updated personal AI provider config", {
    providerLabel: config.providerLabel,
    model: config.model,
    enabled: config.isEnabled,
  })

  return config
}

export async function removeAIUserConfig(userId: string) {
  await prisma.aIUserProviderConfig.deleteMany({ where: { userId } })
  await createAIAuditLog(userId, userId, "ai_user_config_deleted", "Removed personal AI provider config")
}

export async function markAIUserConfigTest(userId: string, status: "passed" | "failed") {
  await prisma.aIUserProviderConfig.updateMany({
    where: { userId },
    data: {
      lastTestedAt: new Date(),
      lastTestStatus: status,
    },
  })

  await createAIAuditLog(userId, userId, "ai_user_config_tested", `Tested personal AI provider config: ${status}`)
}

export async function testAIProviderConnection(input: AIProviderConfigInput) {
  const url = `${normalizeBaseUrl(input.baseUrl)}/models`
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${input.apiKey.trim()}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  })
  if (!response.ok) {
    const text = await response.text().catch(() => "")
    throw new Error(text || `Provider test failed with status ${response.status}`)
  }
  return true
}

export async function getMyAIAccessRequest(userId: string) {
  return prisma.aIAccessRequest.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
  })
}

export async function createAIAccessRequest(userId: string, input: AIAccessRequestInput) {
  const request = await prisma.aIAccessRequest.create({
    data: {
      userId,
      message: input.message.trim(),
      status: "pending",
    },
  })

  await createAIAuditLog(userId, userId, "ai_access_requested", "Submitted AI access request", {
    requestId: request.id,
  })

  return request
}

export async function listAdminAIRequests() {
  return prisma.aIAccessRequest.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { id: true, email: true, displayName: true } },
      reviewedBy: { select: { id: true, email: true, displayName: true } },
    },
  })
}

export async function createAIAuditLog(
  actorId: string | null,
  targetUserId: string | null,
  action: string,
  detail: string,
  metadata?: Prisma.InputJsonValue
) {
  await prisma.aIAuditLog.create({
    data: {
      actorId: actorId ?? undefined,
      targetUserId: targetUserId ?? undefined,
      action,
      detail,
      metadata,
    },
  })
}

export async function approveAIAccessRequest(adminId: string, requestId: string, reviewNote: string) {
  const request = await prisma.aIAccessRequest.findUnique({
    where: { id: requestId },
    include: { user: { select: { id: true, email: true } } },
  })
  if (!request) throw new Error("NOT_FOUND")

  const updated = await prisma.aIAccessRequest.update({
    where: { id: requestId },
    data: {
      status: "approved",
      reviewNote,
      reviewedById: adminId,
      reviewedAt: new Date(),
    },
  })

  await createAIAuditLog(adminId, request.userId, "ai_request_approved", `Approved AI access request for ${request.user.email}`, {
    requestId,
  })

  return updated
}

export async function rejectAIAccessRequest(adminId: string, requestId: string, reviewNote: string) {
  const request = await prisma.aIAccessRequest.findUnique({
    where: { id: requestId },
    include: { user: { select: { id: true, email: true } } },
  })
  if (!request) throw new Error("NOT_FOUND")

  const updated = await prisma.aIAccessRequest.update({
    where: { id: requestId },
    data: {
      status: "rejected",
      reviewNote,
      reviewedById: adminId,
      reviewedAt: new Date(),
    },
  })

  await createAIAuditLog(adminId, request.userId, "ai_request_rejected", `Rejected AI access request for ${request.user.email}`, {
    requestId,
  })

  return updated
}

export async function upsertAIGrant(adminId: string, userId: string, input: AIGrantInput) {
  const apiKey = input.apiKey.trim()
  const encryptedApiKey = encryptSecret(apiKey)
  const normalizedBaseUrl = normalizeBaseUrl(input.baseUrl)

  const grant = await prisma.aIUsageGrant.upsert({
    where: { userId },
    update: {
      providerLabel: input.providerLabel.trim(),
      baseUrl: normalizedBaseUrl,
      apiKeyEncrypted: encryptedApiKey,
      apiKeyMask: maskApiKey(apiKey),
      model: input.model.trim(),
      temperature: input.temperature ?? 0.7,
      streamEnabled: input.streamEnabled ?? true,
      status: input.status ?? "active",
      updatedById: adminId,
      revokedAt: null,
    },
    create: {
      userId,
      providerLabel: input.providerLabel.trim(),
      baseUrl: normalizedBaseUrl,
      apiKeyEncrypted: encryptedApiKey,
      apiKeyMask: maskApiKey(apiKey),
      model: input.model.trim(),
      temperature: input.temperature ?? 0.7,
      streamEnabled: input.streamEnabled ?? true,
      status: input.status ?? "active",
      grantedById: adminId,
      updatedById: adminId,
    },
  })

  await createAIAuditLog(adminId, userId, "ai_grant_upserted", "Updated AI usage grant", {
    providerLabel: grant.providerLabel,
    model: grant.model,
    status: grant.status,
  })

  return grant
}

export async function updateAIGrantStatus(adminId: string, userId: string, status: "paused" | "revoked") {
  const grant = await prisma.aIUsageGrant.findUnique({ where: { userId } })
  if (!grant) throw new Error("NOT_FOUND")

  const updated = await prisma.aIUsageGrant.update({
    where: { userId },
    data: {
      status,
      updatedById: adminId,
      revokedAt: status === "revoked" ? new Date() : null,
    },
  })

  await createAIAuditLog(adminId, userId, `ai_grant_${status}`, `Marked AI grant as ${status}`, { userId })
  return updated
}

export async function getAdminAIOverview() {
  const [requestCounts, grants, recentAudits] = await Promise.all([
    prisma.aIAccessRequest.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    prisma.aIUsageGrant.findMany({
      orderBy: { updatedAt: "desc" },
      take: 10,
      include: {
        user: { select: { id: true, email: true, displayName: true } },
      },
    }),
    prisma.aIAuditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ])

  return {
    requestCounts: requestCounts.reduce<Record<string, number>>((acc, item) => {
      acc[item.status] = item._count._all
      return acc
    }, {}),
    grants: grants.map((grant) => ({
      id: grant.id,
      userId: grant.userId,
      status: grant.status,
      providerLabel: grant.providerLabel,
      baseUrl: grant.baseUrl,
      apiKeyMask: grant.apiKeyMask,
      model: grant.model,
      temperature: grant.temperature,
      streamEnabled: grant.streamEnabled,
      updatedAt: grant.updatedAt.toISOString(),
      user: grant.user,
    })),
    recentAudits: recentAudits.map((item) => ({
      id: item.id,
      action: item.action,
      detail: item.detail,
      targetUserId: item.targetUserId,
      createdAt: item.createdAt.toISOString(),
    })),
    tools: AI_TOOL_DESCRIPTORS,
  }
}

export async function createAIConversationWithMessages({
  userId,
  conversationId,
  prompt,
  status,
}: {
  userId: string
  conversationId?: string
  prompt: string
  status: AIStatusSnapshot
}) {
  const conversation = conversationId
    ? await getAIConversationOrThrow(userId, conversationId)
    : await createAIConversation(userId, { title: buildConversationTitle(prompt) })

  if (conversationId) {
    await updateAIConversationTitleIfNeeded(userId, conversationId, prompt)
  }

  const userMessage = await prisma.aIMessage.create({
    data: {
      conversationId: conversation.id,
      userId,
      role: "user",
      contentMarkdown: prompt,
      status: "completed",
      providerSource: status.source,
    },
  })

  const assistantMessage = await prisma.aIMessage.create({
    data: {
      conversationId: conversation.id,
      userId,
      role: "assistant",
      status: "streaming",
      reasoningSummary: "正在分析你的问题并决定需要读取哪些受控数据。",
      toolTraceSummary: "尚未执行工具。",
      modelName: status.config?.model ?? "",
      providerSource: status.source,
    },
  })

  await prisma.aIConversation.update({
    where: { id: conversation.id },
    data: { lastMessageAt: new Date() },
  })

  return { conversation, userMessage, assistantMessage }
}

export async function finalizeAssistantMessage({
  assistantMessageId,
  contentMarkdown,
  reasoningSummary,
  toolTraceSummary,
  modelName,
}: {
  assistantMessageId: string
  contentMarkdown: string
  reasoningSummary: string
  toolTraceSummary: string
  modelName?: string
}) {
  return prisma.aIMessage.update({
    where: { id: assistantMessageId },
    data: {
      contentMarkdown,
      reasoningSummary,
      toolTraceSummary,
      status: "completed",
      ...(modelName ? { modelName } : {}),
    },
  })
}

export async function failAssistantMessage(assistantMessageId: string, errorMessage: string) {
  return prisma.aIMessage.update({
    where: { id: assistantMessageId },
    data: {
      status: "failed",
      contentMarkdown: errorMessage,
    },
  })
}

export async function createAIToolCallLog({
  conversationId,
  messageId,
  userId,
  toolName,
  toolInputJson,
}: {
  conversationId: string
  messageId: string
  userId: string
  toolName: string
  toolInputJson?: Prisma.InputJsonValue
}) {
  const data: Prisma.AIToolCallLogUncheckedCreateInput = {
    conversationId,
    messageId,
    userId,
    toolName,
    toolInputJson: toolInputJson ?? Prisma.JsonNull,
    status: "running",
  }

  return prisma.aIToolCallLog.create({
    data,
  })
}

export async function completeAIToolCallLog(logId: string, result: unknown, status: "completed" | "failed") {
  const data: Prisma.AIToolCallLogUncheckedUpdateInput = {
    status,
    finishedAt: new Date(),
    toolResultJson: (result as Prisma.InputJsonValue | undefined) ?? Prisma.JsonNull,
  }

  return prisma.aIToolCallLog.update({
    where: { id: logId },
    data,
  })
}
