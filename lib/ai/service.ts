import "server-only"
import { Prisma } from "@/app/generated/prisma/client"
import { decryptSecret, encryptSecret, hasAISecretKey, maskApiKey } from "@/lib/ai/crypto"
import { probeProviderCapabilities, withProviderCapabilities } from "@/lib/ai/provider"
import { prisma } from "@/lib/db"
import { AI_TOOL_DESCRIPTORS } from "@/lib/ai/tools/registry"
import { getRunSnapshot } from "@/lib/ai/run-stream-bus"
import type {
  AIConversationHistoryEntry,
  AIConversationListItem,
  ActiveSkillRecord,
  AIMessageItem,
  AIMessageStepPreview,
  AIResolvedProviderConfig,
  AIRunDetail,
  AIRunMode,
  AIRunStepItem,
  AIRunStepStatus,
  AIRunStepType,
  AISafeProviderConfig,
  AIStatusSnapshot,
} from "@/lib/ai/types"
import type {
  AIAccessRequestInput,
  AIAttachmentInput,
  AIConversationCreateInput,
  AIConversationUpdateInput,
  AIGrantInput,
  AIGrantUpsertInput,
  AIProviderConfigInput,
  AIProviderConfigUpdateInput,
} from "@/lib/validators"

function parseModelList(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string" && v.trim().length > 0) : []
  } catch {
    return []
  }
}

function toSafeConfig(value: {
  providerLabel: string
  baseUrl: string
  model: string
  temperature: number
  streamEnabled: boolean
}): AISafeProviderConfig {
  return withProviderCapabilities({
    providerLabel: value.providerLabel,
    baseUrl: value.baseUrl,
    model: value.model,
    temperature: value.temperature,
    streamEnabled: value.streamEnabled,
  })
}

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.trim().replace(/\/+$/, "")
}

function toJsonValue(value: unknown) {
  return (value as Prisma.InputJsonValue | undefined) ?? Prisma.JsonNull
}

function toStepPreview(step: {
  id: string
  type: string
  title: string
  status: string
  startedAt: Date
  finishedAt: Date | null
  summary: string
  errorMessage: string
}): AIMessageStepPreview {
  return {
    id: step.id,
    type: step.type as AIMessageStepPreview["type"],
    title: step.title,
    status: step.status as AIMessageStepPreview["status"],
    startedAt: step.startedAt.toISOString(),
    finishedAt: step.finishedAt?.toISOString() ?? null,
    summary: step.summary,
    errorMessage: step.errorMessage,
  }
}

function toRunStepItem(step: {
  id: string
  type: string
  title: string
  status: string
  startedAt: Date
  finishedAt: Date | null
  summary: string
  inputPreview: Prisma.JsonValue | null
  outputPreview: Prisma.JsonValue | null
  errorMessage: string
}): AIRunStepItem {
  const providerMetadata =
    step.outputPreview && typeof step.outputPreview === "object" && !Array.isArray(step.outputPreview) && "providerMetadata" in step.outputPreview
      ? ((step.outputPreview as { providerMetadata?: Record<string, unknown> | null }).providerMetadata ?? null)
      : null

  return {
    id: step.id,
    type: step.type as AIRunStepType,
    title: step.title,
    status: step.status as AIRunStepStatus,
    startedAt: step.startedAt.toISOString(),
    finishedAt: step.finishedAt?.toISOString() ?? null,
    summary: step.summary,
    inputPreview: step.inputPreview,
    outputPreview: step.outputPreview,
    providerMetadata,
    errorMessage: step.errorMessage,
  }
}

function buildConversationTitle(prompt: string) {
  return prompt.trim().replace(/\s+/g, " ").slice(0, 60) || "新会话"
}

function isDefaultConversationTitle(title: string) {
  const t = title.trim()
  return t === "" || t === "New conversation" || t === "新会话" || t === "新建对话" || t === "新建会话"
}

export async function getAIStatusSnapshot(userId: string): Promise<AIStatusSnapshot> {
  const [activeConfig, grant, latestRequest] = await Promise.all([
    getActiveUserConfig(userId),
    prisma.aIUsageGrant.findUnique({ where: { userId } }),
    prisma.aIAccessRequest.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
    }),
  ])

  const storageReady = hasAISecretKey()

  if (!storageReady) {
    return {
      canUseAI: false,
      source: "none",
      reason: "server-secret-missing",
      config: null,
      configState: {
        storageReady,
        hasUserConfig: Boolean(activeConfig),
        userConfigEnabled: Boolean(activeConfig?.isEnabled),
        hasGrant: Boolean(grant),
        grantStatus: grant?.status ?? null,
        accessRequestStatus: latestRequest?.status ?? null,
      },
    }
  }

  if (activeConfig && activeConfig.isEnabled && activeConfig.apiKeyEncrypted) {
    return {
      canUseAI: true,
      source: "user",
      reason: "ready",
      config: toSafeConfig(activeConfig),
      configState: {
        storageReady,
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
        storageReady,
        hasUserConfig: Boolean(activeConfig),
        userConfigEnabled: Boolean(activeConfig?.isEnabled),
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
  else if (!activeConfig && !grant) reason = "request-access"

  return {
    canUseAI: false,
    source: "none",
    reason,
    config: null,
    configState: {
      storageReady,
      hasUserConfig: Boolean(activeConfig),
      userConfigEnabled: Boolean(activeConfig?.isEnabled),
      hasGrant: Boolean(grant),
      grantStatus: grant?.status ?? null,
      accessRequestStatus: latestRequest?.status ?? null,
    },
  }
}

export async function getEffectiveProviderConfig(userId: string, modelOverride?: string): Promise<AIResolvedProviderConfig | null> {
  const status = await getAIStatusSnapshot(userId)
  if (!status.canUseAI || !status.config) return null
  const resolvedModel = modelOverride?.trim() || status.config.model

  if (status.source === "user") {
    const config = await getActiveUserConfig(userId)
    if (!config?.apiKeyEncrypted) return null
    return {
      ...toSafeConfig({ ...config, model: resolvedModel }),
      source: "user",
      apiKey: decryptSecret(config.apiKeyEncrypted),
    }
  }

  const grant = await prisma.aIUsageGrant.findUnique({ where: { userId } })
  if (!grant?.apiKeyEncrypted) return null
  if (grant.status === "paused") {
    const error: Error & { code?: string } = new Error("管理员已暂停该模型的使用授权")
    error.code = "GRANT_PAUSED"
    throw error
  }
  if (grant.status === "revoked" || grant.status === "deprecated") {
    const error: Error & { code?: string } = new Error("管理员已弃用该配置")
    error.code = "GRANT_REVOKED"
    throw error
  }
  if (grant.status !== "active") return null
  return {
    ...toSafeConfig({ ...grant, model: resolvedModel }),
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

// Link a tool-generated file (e.g. a compiled LaTeX PDF) to the assistant
// message that produced it, so it renders as a durable download card and
// survives reload — instead of relying on a link smuggled into the reply text.
// Idempotent: a repeated call for the same upload is a no-op.
export async function attachGeneratedFileToMessage(params: {
  messageId: string
  userId: string
  uploadId: string
  originalName: string
  mimeType: string
  size: number
  url: string
}): Promise<void> {
  const existing = await prisma.aIMessageAttachment.findFirst({
    where: { messageId: params.messageId, uploadId: params.uploadId },
    select: { id: true },
  })
  if (existing) return
  await prisma.aIMessageAttachment.create({
    data: {
      messageId: params.messageId,
      userId: params.userId,
      uploadId: params.uploadId,
      originalName: params.originalName,
      mimeType: params.mimeType,
      size: params.size,
      url: params.url,
    },
  })
}

// Recover the injected-skills record from a run's persisted "skill" step.
function extractActiveSkills(steps?: ReadonlyArray<{ type: string; outputPreview: unknown }> | null): ActiveSkillRecord[] {
  const skillStep = steps?.find((s) => s.type === "skill")
  const raw = skillStep && skillStep.outputPreview && typeof skillStep.outputPreview === "object"
    ? (skillStep.outputPreview as { activeSkills?: unknown }).activeSkills
    : null
  if (!Array.isArray(raw)) return []
  return raw.filter((s): s is ActiveSkillRecord =>
    Boolean(s && typeof s === "object" && typeof (s as ActiveSkillRecord).id === "string"))
}

// Real runtime metadata of the most recent assistant turn in a conversation, for
// the get_last_run_metadata tool — so the model answers "did you use a skill"
// from evidence, not self-report. Includes the last compiled-PDF metadata if any.
export async function getLastRunMetadata(userId: string, conversationId: string): Promise<{
  runId: string | null
  activeSkills: ActiveSkillRecord[]
  lastPdf: Record<string, unknown> | null
}> {
  // The most recent COMPLETED assistant run — the current (in-flight) run is still
  // "running", so this returns the previous turn, which is what "刚才" refers to.
  const msg = await prisma.aIMessage.findFirst({
    where: { userId, conversationId, role: "assistant", runRecord: { is: { status: "completed" } } },
    orderBy: { createdAt: "desc" },
    select: {
      runRecord: {
        select: { id: true, steps: { select: { type: true, outputPreview: true }, orderBy: { orderIndex: "asc" } } },
      },
    },
  })
  const steps = msg?.runRecord?.steps
  const activeSkills = extractActiveSkills(steps)
  const pdfLog = await prisma.aIToolCallLog.findFirst({
    where: { userId, conversationId, toolName: "compile_latex_pdf", status: "completed" },
    orderBy: { startedAt: "desc" },
    select: { toolResultJson: true },
  }).catch(() => null)
  const result = pdfLog?.toolResultJson as { data?: Record<string, unknown> } | null
  const data = result?.data ?? null
  const lastPdf = data
    ? {
        usedBodySource: data.usedBodySource ?? null,
        sectionCount: data.sectionCount ?? null,
        pdfPageCount: data.pdfPageCount ?? null,
        templatesLoaded: data.templatesLoaded ?? null,
        selectedTemplate: data.selectedTemplate ?? null,
        selectedTheme: data.selectedTheme ?? null,
        selectedPalette: data.selectedPalette ?? null,
      }
    : null
  return { runId: msg?.runRecord?.id ?? null, activeSkills, lastPdf }
}

export async function listAIConversationMessages(userId: string, conversationId: string): Promise<AIMessageItem[]> {
  await getAIConversationOrThrow(userId, conversationId)
  const items = await prisma.aIMessage.findMany({
    where: { userId, conversationId },
    orderBy: { createdAt: "asc" },
    include: {
      attachments: {
        select: {
          id: true,
          uploadId: true,
          url: true,
          originalName: true,
          mimeType: true,
          size: true,
          upload: {
            select: {
              pdfDocument: {
                select: {
                  id: true,
                  status: true,
                },
              },
            },
          },
        },
      },
      runRecord: {
        select: {
          id: true,
          mode: true,
          status: true,
          delegatedTargetUserId: true,
          steps: {
            orderBy: [{ startedAt: "asc" }, { orderIndex: "asc" }],
            take: 5,
            select: {
              id: true,
              type: true,
              title: true,
              status: true,
              startedAt: true,
              finishedAt: true,
              summary: true,
              errorMessage: true,
              outputPreview: true,
            },
          },
        },
      },
    },
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
    runId: item.runRecord?.id ?? null,
    runMode: (item.runRecord?.mode as AIRunMode | null) ?? null,
    runStatus: item.runRecord?.status ?? null,
    delegatedTargetUserId: item.runRecord?.delegatedTargetUserId ?? null,
    stepsPreview: item.runRecord?.steps.map(toStepPreview) ?? [],
    // Real runtime state for the trace: which skills were injected this turn,
    // recovered from the persisted "skill" step. Survives refresh.
    activeSkills: extractActiveSkills(item.runRecord?.steps),
    attachments: item.attachments.map((attachment) => ({
      id: attachment.id,
      uploadId: attachment.uploadId,
      url: attachment.url,
      originalName: attachment.originalName,
      mimeType: attachment.mimeType,
      size: attachment.size,
      pdfDocumentId: attachment.upload?.pdfDocument?.id ?? null,
      parseStatus: attachment.upload?.pdfDocument?.status ?? null,
    })),
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

export async function getAIUserConfigs(userId: string) {
  const configs = await prisma.aIUserProviderConfig.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      isActive: true,
      providerLabel: true,
      baseUrl: true,
      model: true,
      modelList: true,
      temperature: true,
      streamEnabled: true,
      isEnabled: true,
      apiKeyMask: true,
      lastTestedAt: true,
      lastTestStatus: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  return configs.map((c) => ({
    ...c,
    modelList: parseModelList(c.modelList),
    lastTestedAt: c.lastTestedAt?.toISOString() ?? null,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  }))
}

export async function getAIUserConfigById(configId: string) {
  return prisma.aIUserProviderConfig.findUnique({ where: { id: configId } })
}

export async function getAIUnifiedConfigs(userId: string) {
  const [userConfigs, grant] = await Promise.all([
    getAIUserConfigs(userId),
    prisma.aIUsageGrant.findUnique({ where: { userId } }),
  ])

  const selfConfigs = userConfigs.map((c) => ({
    id: c.id,
    source: "self" as const,
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
    status: "active",
    lastTestStatus: c.lastTestStatus,
    lastTestedAt: c.lastTestedAt,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    grantedByAdminId: undefined as string | undefined,
  }))

  const grantConfigs = grant
    ? [
        {
          id: grant.id,
          source: "admin_grant" as const,
          name: `管理员授权 - ${grant.providerLabel}`,
          isActive: !userConfigs.some((c) => c.isActive),
          providerLabel: grant.providerLabel,
          baseUrl: grant.baseUrl,
          model: grant.model,
          modelList: parseModelList(grant.modelList),
          temperature: grant.temperature,
          streamEnabled: grant.streamEnabled,
          webSearchEnabled: grant.webSearchEnabled,
          isEnabled: grant.status === "active",
          apiKeyMask: grant.apiKeyMask,
          status: grant.status,
          lastTestStatus: "unknown",
          lastTestedAt: null,
          createdAt: grant.createdAt.toISOString(),
          updatedAt: grant.updatedAt.toISOString(),
          grantedByAdminId: grant.grantedById,
        },
      ]
    : []

  return { selfConfigs, grantConfigs }
}

export async function getActiveUserConfig(userId: string) {
  return prisma.aIUserProviderConfig.findFirst({
    where: { userId, isActive: true },
  })
}

export async function createAIUserConfig(userId: string, input: AIProviderConfigInput) {
  if (!input.name?.trim()) throw new Error("配置名称不能为空")

  const apiKey = input.apiKey.trim()
  const encryptedApiKey = encryptSecret(apiKey)
  const normalizedBaseUrl = normalizeBaseUrl(input.baseUrl)

  const activeCount = await prisma.aIUserProviderConfig.count({ where: { userId, isActive: true } })
  const isActive = activeCount === 0

  const modelListJson = JSON.stringify(input.modelList?.filter(Boolean) ?? [])

  const config = await prisma.aIUserProviderConfig.create({
    data: {
      userId,
      name: input.name.trim(),
      isActive,
      providerType: "openai-compatible",
      providerLabel: input.providerLabel.trim(),
      baseUrl: normalizedBaseUrl,
      apiKeyEncrypted: encryptedApiKey,
      apiKeyMask: maskApiKey(apiKey),
      model: input.model.trim(),
      temperature: input.temperature ?? 0.7,
      streamEnabled: input.streamEnabled ?? true,
      isEnabled: input.isEnabled ?? true,
      modelList: modelListJson,
    },
  })

  await createAIAuditLog(userId, userId, "ai_user_config_created", "Created AI provider config", {
    configId: config.id,
    name: config.name,
    providerLabel: config.providerLabel,
    model: config.model,
  })

  return config
}

export async function updateAIUserConfig(configId: string, input: AIProviderConfigUpdateInput) {
  const existing = await prisma.aIUserProviderConfig.findUnique({ where: { id: configId } })
  if (!existing) throw new Error("配置不存在")

  const apiKey = typeof input.apiKey === "string" ? input.apiKey.trim() : undefined
  const encryptedApiKey = apiKey ? encryptSecret(apiKey) : undefined

  const data: Record<string, unknown> = {}
  if (input.name !== undefined) data.name = input.name.trim()
  if (input.providerLabel !== undefined) data.providerLabel = input.providerLabel.trim()
  if (input.baseUrl !== undefined) data.baseUrl = normalizeBaseUrl(input.baseUrl)
  if (input.model !== undefined) data.model = input.model.trim()
  if (input.temperature !== undefined) data.temperature = input.temperature
  if (input.streamEnabled !== undefined) data.streamEnabled = input.streamEnabled
  if (input.isEnabled !== undefined) data.isEnabled = input.isEnabled
  if (encryptedApiKey) {
    data.apiKeyEncrypted = encryptedApiKey
    data.apiKeyMask = maskApiKey(apiKey!)
  }
  if (input.modelList !== undefined) {
    data.modelList = JSON.stringify(input.modelList.filter(Boolean))
  }

  const config = await prisma.aIUserProviderConfig.update({
    where: { id: configId },
    data,
  })

  await createAIAuditLog(existing.userId, existing.userId, "ai_user_config_updated", "Updated AI provider config", {
    configId: config.id,
    name: config.name,
    providerLabel: config.providerLabel,
    model: config.model,
  })

  return config
}

export async function deleteAIUserConfig(configId: string) {
  const existing = await prisma.aIUserProviderConfig.findUnique({ where: { id: configId } })
  if (!existing) throw new Error("配置不存在")

  await prisma.aIUserProviderConfig.delete({ where: { id: configId } })

  if (existing.isActive) {
    const next = await prisma.aIUserProviderConfig.findFirst({
      where: { userId: existing.userId },
      orderBy: { updatedAt: "desc" },
    })
    if (next) {
      await prisma.aIUserProviderConfig.update({
        where: { id: next.id },
        data: { isActive: true },
      })
    }
  }

  await createAIAuditLog(existing.userId, existing.userId, "ai_user_config_deleted", "Deleted AI provider config", {
    configId,
    name: existing.name,
  })
}

export async function setActiveAIUserConfig(configId: string) {
  const config = await prisma.aIUserProviderConfig.findUnique({ where: { id: configId } })
  if (!config) throw new Error("配置不存在")

  await prisma.aIUserProviderConfig.updateMany({
    where: { userId: config.userId },
    data: { isActive: false },
  })

  await prisma.aIUserProviderConfig.update({
    where: { id: configId },
    data: { isActive: true },
  })

  await createAIAuditLog(config.userId, config.userId, "ai_user_config_activated", "Set active AI provider config", {
    configId,
    name: config.name,
  })
}

export async function activateAIUnifiedConfig(userId: string, configId: string, source: string) {
  if (source === "admin_grant") {
    const grant = await prisma.aIUsageGrant.findUnique({ where: { id: configId } })
    if (!grant || grant.userId !== userId) throw new Error("NOT_FOUND")
    if (grant.status === "paused") {
      const error: Error & { code?: string } = new Error("该模型已被管理员暂停使用，请联系管理员")
      error.code = "GRANT_PAUSED"
      throw error
    }
    if (grant.status === "revoked" || grant.status === "deprecated") {
      const error: Error & { code?: string } = new Error("该配置已被管理员弃用")
      error.code = "GRANT_REVOKED"
      throw error
    }
    // Deactivate all user self configs, grant becomes the effective config
    await prisma.aIUserProviderConfig.updateMany({
      where: { userId },
      data: { isActive: false },
    })
    await createAIAuditLog(userId, userId, "ai_grant_activated", "Activated admin grant as AI config", {
      grantId: configId,
    })
    return { success: true }
  }

  // self config activation
  await setActiveAIUserConfig(configId)
  return { success: true }
}

export async function markAIUserConfigTest(configId: string, status: "passed" | "failed") {
  const config = await prisma.aIUserProviderConfig.findUnique({ where: { id: configId } })
  if (!config) return

  await prisma.aIUserProviderConfig.update({
    where: { id: configId },
    data: {
      lastTestedAt: new Date(),
      lastTestStatus: status,
    },
  })

  await createAIAuditLog(config.userId, config.userId, "ai_user_config_tested", `Tested AI provider config: ${status}`, {
    configId,
    name: config.name,
  })
}

export async function testAIProviderConnection(input: AIProviderConfigInput) {
  return probeProviderCapabilities({
    providerLabel: input.providerLabel,
    baseUrl: normalizeBaseUrl(input.baseUrl),
    apiKey: input.apiKey.trim(),
    model: input.model.trim(),
    temperature: input.temperature ?? 0.7,
    streamEnabled: input.streamEnabled ?? true,
  })
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
  const requests = await prisma.aIAccessRequest.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      user: {
        select: {
          id: true, email: true, displayName: true,
          aiUsageGrant: { select: { id: true, status: true, providerLabel: true } },
        },
      },
      reviewedBy: { select: { id: true, email: true, displayName: true } },
    },
  })

  return requests.map((r) => ({
    ...r,
    grant: r.user.aiUsageGrant ?? null,
    user: { id: r.user.id, email: r.user.email, displayName: r.user.displayName },
  }))
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

export async function upsertAIGrant(adminId: string, userId: string, input: AIGrantUpsertInput) {
  const apiKey = (typeof input.apiKey === "string" ? input.apiKey.trim() : "")
  const hasNewApiKey = apiKey.length > 0
  const encryptedApiKey = hasNewApiKey ? encryptSecret(apiKey) : undefined
  const apiKeyMasked = hasNewApiKey ? maskApiKey(apiKey) : undefined
  const normalizedBaseUrl = normalizeBaseUrl(input.baseUrl)
  const modelListJson = JSON.stringify(input.modelList?.filter(Boolean) ?? [])

  // Validate user exists
  const targetUser = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true } })
  if (!targetUser) throw new Error("TARGET_USER_NOT_FOUND")

  // Check if grant already exists to determine create vs update
  const existingGrant = await prisma.aIUsageGrant.findUnique({ where: { userId } })
  const isUpdate = Boolean(existingGrant)

  const commonData = {
    providerLabel: input.providerLabel.trim(),
    baseUrl: normalizedBaseUrl,
    model: input.model.trim(),
    temperature: input.temperature ?? 0.7,
    streamEnabled: input.streamEnabled ?? true,
    modelList: modelListJson,
    webSearchEnabled: input.webSearchEnabled ?? false,
  }

  const grant = isUpdate
    ? await prisma.aIUsageGrant.update({
        where: { userId },
        data: {
          ...commonData,
          ...(hasNewApiKey ? { apiKeyEncrypted: encryptedApiKey!, apiKeyMask: apiKeyMasked! } : {}),
          status: input.status ?? existingGrant!.status,
          updatedById: adminId,
          revokedAt: input.status === "active" ? null : input.status === "revoked" || input.status === "deprecated" ? new Date() : undefined,
        },
      })
    : await prisma.aIUsageGrant.create({
        data: {
          ...commonData,
          userId,
          apiKeyEncrypted: encryptedApiKey ?? "",
          apiKeyMask: apiKeyMasked ?? "",
          status: input.status ?? "active",
          grantedById: adminId,
          updatedById: adminId,
        },
      })

  // Handle requestId if provided: mark that specific request as configured
  if (input.requestId) {
    const request = await prisma.aIAccessRequest.findUnique({ where: { id: input.requestId } })
    if (request && request.userId === userId && (request.status === "pending" || request.status === "approved")) {
      await prisma.aIAccessRequest.update({
        where: { id: input.requestId },
        data: { status: "configured" },
      })
    }
  } else {
    // Auto-mark any pending/approved access request as configured (backward-compatible)
    const pendingRequest = await prisma.aIAccessRequest.findFirst({
      where: { userId, status: { in: ["pending", "approved"] } },
      orderBy: { createdAt: "desc" },
    })
    if (pendingRequest) {
      await prisma.aIAccessRequest.update({
        where: { id: pendingRequest.id },
        data: { status: "configured" },
      })
    }
  }

  const note = input.note ? ` — ${input.note}` : ""
  const auditAction = isUpdate ? "ai_grant_updated" : "ai_grant_created"
  const auditDetail = isUpdate
    ? `Updated AI usage grant for ${targetUser.email} by admin${note}`
    : `Created AI usage grant for ${targetUser.email} by admin${note}`
  await createAIAuditLog(adminId, userId, auditAction, auditDetail, {
    providerLabel: grant.providerLabel,
    model: grant.model,
    status: grant.status,
  })

  return grant
}

export async function updateAIGrantStatus(adminId: string, userId: string, status: string) {
  const grant = await prisma.aIUsageGrant.findUnique({ where: { userId } })
  if (!grant) throw new Error("NOT_FOUND")

  const data: Record<string, unknown> = {
    status,
    updatedById: adminId,
  }

  if (status === "revoked" || status === "deprecated") {
    data.revokedAt = new Date()
  } else if (status === "active") {
    data.revokedAt = null
  }

  const updated = await prisma.aIUsageGrant.update({
    where: { userId },
    data,
  })

  await createAIAuditLog(adminId, userId, `ai_grant_${status}`, `Marked AI grant as ${status}`, { userId })
  return updated
}

export async function deleteAIGrant(adminId: string, userId: string) {
  const grant = await prisma.aIUsageGrant.findUnique({ where: { userId } })
  if (!grant) throw new Error("NOT_FOUND")

  await prisma.aIUsageGrant.delete({ where: { userId } })

  await createAIAuditLog(adminId, userId, "ai_grant_deleted", "Deleted AI usage grant", { userId })
}

export async function cancelAIAccessRequest(userId: string) {
  const request = await prisma.aIAccessRequest.findFirst({
    where: { userId, status: "pending" },
    orderBy: { createdAt: "desc" },
  })
  if (!request) throw new Error("NOT_FOUND")

  const updated = await prisma.aIAccessRequest.update({
    where: { id: request.id },
    data: { status: "cancelled" },
  })

  await createAIAuditLog(userId, userId, "ai_request_cancelled", "Cancelled AI access request", {
    requestId: request.id,
  })

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
  const webSearchConfigs = await prisma.aIWebSearchConfig.findMany({
    where: { ownerType: "ADMIN_GRANT", ownerId: { in: grants.map((grant) => grant.id) } },
  })
  const webSearchByOwner = new Map(webSearchConfigs.map((config) => [config.ownerId, config]))

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
      modelList: parseModelList(grant.modelList),
      temperature: grant.temperature,
      streamEnabled: grant.streamEnabled,
      webSearchEnabled: grant.webSearchEnabled,
      webSearch: (() => {
        const config = webSearchByOwner.get(grant.id)
        return config
          ? {
              enabled: config.enabled,
              configured: Boolean(config.apiKeyMask),
              apiKeyMask: config.apiKeyMask,
              host: config.host,
              workspace: config.workspace,
              serviceId: config.serviceId,
            }
          : {
              enabled: false,
              configured: false,
              apiKeyMask: "",
              host: "",
              workspace: "default",
              serviceId: "ops-web-search-001",
            }
      })(),
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

export async function createAIRun(params: {
  conversationId: string
  messageId: string
  userId: string
  prompt: string
  mode?: AIRunMode
  delegatedTargetUserId?: string | null
  plannerModel?: string
}) {
  const run = await prisma.aIRun.create({
    data: {
      conversationId: params.conversationId,
      messageId: params.messageId,
      userId: params.userId,
      prompt: params.prompt,
      mode: params.mode ?? "self",
      delegatedTargetUserId: params.delegatedTargetUserId ?? undefined,
      plannerModel: params.plannerModel ?? "heuristic-planner",
      status: "running",
    },
  })

  return run
}

export async function createAIRunStep(params: {
  runId: string
  messageId: string
  userId: string
  type: AIRunStepType
  title: string
  summary?: string
  inputPreview?: unknown
  outputPreview?: unknown
  orderIndex?: number
}) {
  return prisma.aIRunStep.create({
    data: {
      runId: params.runId,
      messageId: params.messageId,
      userId: params.userId,
      type: params.type,
      title: params.title,
      summary: params.summary ?? "",
      inputPreview: toJsonValue(params.inputPreview),
      outputPreview: toJsonValue(params.outputPreview),
      orderIndex: params.orderIndex ?? 0,
      status: "running",
    },
  })
}

export async function completeAIRunStep(
  stepId: string,
  params: {
    status: AIRunStepStatus
    summary?: string
    outputPreview?: unknown
    errorMessage?: string
  }
) {
  return prisma.aIRunStep.update({
    where: { id: stepId },
    data: {
      status: params.status,
      summary: params.summary,
      outputPreview: params.outputPreview === undefined ? undefined : toJsonValue(params.outputPreview),
      errorMessage: params.errorMessage ?? undefined,
      finishedAt: new Date(),
    },
  })
}

export async function finalizeAIRun(params: {
  runId: string
  status: "completed" | "failed" | "cancelled"
  summary: string
  finalModel?: string
}) {
  // The run reached a terminal state — drop any in-memory cancel signal for it.
  cancelledRunIds.delete(params.runId)
  // Sweep any step left in "running" to a terminal state so the trace never shows
  // "正在推理/正在调用工具" on a finished run (live or after reload).
  await prisma.aIRunStep.updateMany({
    where: { runId: params.runId, status: "running" },
    data: { status: params.status === "failed" ? "failed" : "completed", finishedAt: new Date() },
  })
  return prisma.aIRun.update({
    where: { id: params.runId },
    data: {
      status: params.status,
      summary: params.summary,
      finalModel: params.finalModel ?? undefined,
      finishedAt: new Date(),
      ...(params.status === "cancelled" ? { cancelledAt: new Date() } : {}),
    },
  })
}

// ─── Server-side run cancellation ────────────────────────────────────────────
// In-process fast path: a cancel request and the running agent loop live in the
// same Node server, so flipping an in-memory flag stops the loop instantly. The
// AIRun.cancelRequestedAt column is the durable source of truth (survives across
// requests/processes) and is what isAIRunCancelled falls back to.
const cancelledRunIds = new Set<string>()

export async function requestAIRunCancellation(userId: string, messageId: string) {
  const run = await prisma.aIRun.findFirst({
    where: { userId, messageId },
    select: { id: true, status: true },
  })
  if (!run) return { runId: null, alreadyFinished: true }

  const finished = ["completed", "failed", "cancelled"].includes(run.status)
  if (finished) return { runId: run.id, alreadyFinished: true }

  // No in-process producer means the agent loop isn't actually running here (e.g.
  // it was orphaned by a server restart). There's no checkpoint left to observe a
  // cancel, so finalize it as cancelled now instead of leaving it stuck at
  // "cancelling" forever.
  if (getRunSnapshot(run.id) === null) {
    cancelledRunIds.add(run.id)
    await prisma.aIRun.update({ where: { id: run.id }, data: { cancelRequestedAt: new Date() } })
    await finalizeAIRun({ runId: run.id, status: "cancelled", summary: "已被用户停止。" })
    await prisma.aIMessage.updateMany({
      where: { id: messageId, status: "streaming" },
      data: { status: "cancelled" },
    })
    return { runId: run.id, alreadyFinished: false }
  }

  cancelledRunIds.add(run.id)
  await prisma.aIRun.update({
    where: { id: run.id },
    data: { status: "cancelling", cancelRequestedAt: new Date() },
  })
  return { runId: run.id, alreadyFinished: false }
}

// Checked at every agent-loop checkpoint (each round, before/after each tool
// call, before LaTeX compile). Cheap: in-memory hit short-circuits, otherwise a
// single primary-key lookup.
export async function isAIRunCancelled(runId: string): Promise<boolean> {
  if (cancelledRunIds.has(runId)) return true
  const run = await prisma.aIRun.findUnique({
    where: { id: runId },
    select: { cancelRequestedAt: true, status: true },
  })
  if (!run) return false
  return Boolean(run.cancelRequestedAt) || run.status === "cancelling" || run.status === "cancelled"
}

// Grace window before a producer-less active run is considered orphaned, to avoid
// racing a run that was just created but hasn't emitted run_started yet.
const ORPHAN_GRACE_MS = 60_000

export async function listActiveAIRuns(userId: string) {
  const runs = await prisma.aIRun.findMany({
    where: { userId, status: { in: ["running", "cancelling"] } },
    orderBy: { createdAt: "desc" },
    select: { id: true, conversationId: true, messageId: true, status: true, createdAt: true },
  })

  const live: typeof runs = []
  for (const run of runs) {
    // A genuinely running run always has an in-process event-bus channel. None
    // means the loop is gone (server restarted mid-run, or a different instance).
    // Self-heal: finalize the orphan so it stops appearing as an active task.
    const orphaned = getRunSnapshot(run.id) === null && Date.now() - run.createdAt.getTime() > ORPHAN_GRACE_MS
    if (orphaned) {
      await finalizeAIRun({ runId: run.id, status: "cancelled", summary: "运行已中断（服务端无活动）。" }).catch(() => null)
      await prisma.aIMessage.updateMany({
        where: { id: run.messageId, status: "streaming" },
        data: { status: "cancelled" },
      }).catch(() => null)
      continue
    }
    live.push(run)
  }

  return live.map((run) => ({
    id: run.id,
    conversationId: run.conversationId,
    messageId: run.messageId,
    status: run.status,
    createdAt: run.createdAt.toISOString(),
  }))
}

export async function getAIRunByMessageId(userId: string, messageId: string, includeSteps = true): Promise<AIRunDetail | null> {
  const run = includeSteps
    ? await prisma.aIRun.findFirst({
        where: { userId, messageId },
        include: {
          steps: {
            orderBy: [{ startedAt: "asc" }, { orderIndex: "asc" }],
          },
        },
      })
    : await prisma.aIRun.findFirst({
        where: { userId, messageId },
      })

  if (!run) return null

  const steps =
    includeSteps && "steps" in run
      ? (run.steps as Array<{
          id: string
          type: string
          title: string
          status: string
          startedAt: Date
          finishedAt: Date | null
          summary: string
          inputPreview: Prisma.JsonValue | null
          outputPreview: Prisma.JsonValue | null
          errorMessage: string
        }>).map(toRunStepItem)
      : []

  return {
    id: run.id,
    messageId: run.messageId,
    conversationId: run.conversationId,
    userId: run.userId,
    prompt: run.prompt,
    mode: run.mode as AIRunMode,
    delegatedTargetUserId: run.delegatedTargetUserId ?? null,
    plannerModel: run.plannerModel,
    finalModel: run.finalModel,
    status: run.status,
    summary: run.summary,
    createdAt: run.createdAt.toISOString(),
    updatedAt: run.updatedAt.toISOString(),
    finishedAt: run.finishedAt?.toISOString() ?? null,
    steps,
  }
}

export async function createAIConversationWithMessages({
  userId,
  conversationId,
  prompt,
  status,
  attachments = [],
}: {
  userId: string
  conversationId?: string
  prompt: string
  status: AIStatusSnapshot
  attachments?: AIAttachmentInput[]
}) {
  let conversation = conversationId
    ? await getAIConversationOrThrow(userId, conversationId).catch(() => null)
    : null

  if (!conversation) {
    conversation = await createAIConversation(userId, { title: buildConversationTitle(prompt) })
  }

  if (conversationId && conversation.id === conversationId) {
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
      attachments: attachments.length
        ? {
            create: attachments.map((attachment) => ({
              userId,
              uploadId: attachment.uploadId ?? null,
              originalName: attachment.originalName,
              mimeType: attachment.mimeType,
              size: attachment.size,
              url: attachment.url,
            })),
          }
        : undefined,
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

  const run = await createAIRun({
    conversationId: conversation.id,
    messageId: assistantMessage.id,
    userId,
    prompt,
  })

  await prisma.aIConversation.update({
    where: { id: conversation.id },
    data: { lastMessageAt: new Date() },
  })

  return { conversation, userMessage, assistantMessage, run }
}

// Persist partial assistant content WHILE the run streams, so a client that
// navigates away / reloads / disconnects can still recover the in-progress text
// (the run keeps going server-side). No-op once the message is finalized — the
// status filter prevents a late delta from reverting completed content/status.
export async function updateAssistantMessagePartial(assistantMessageId: string, contentMarkdown: string) {
  await prisma.aIMessage.updateMany({
    where: { id: assistantMessageId, status: "streaming" },
    data: { contentMarkdown },
  })
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

// User stopped the run: keep whatever partial content was already streamed and
// mark the message cancelled (distinct from completed/failed).
export async function cancelAssistantMessage(assistantMessageId: string, contentMarkdown: string) {
  return prisma.aIMessage.update({
    where: { id: assistantMessageId },
    data: {
      status: "cancelled",
      contentMarkdown,
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
  toolInputJson?: unknown
}) {
  const data: Prisma.AIToolCallLogUncheckedCreateInput = {
    conversationId,
    messageId,
    userId,
    toolName,
    toolInputJson: toJsonValue(toolInputJson),
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
