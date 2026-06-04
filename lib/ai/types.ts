export type AIProviderSource = "user" | "grant" | "none"

export type AiConfigSource = "self" | "admin_grant"

export type AIUnifiedConfigItem = {
  id: string
  source: AiConfigSource
  name: string
  isActive: boolean
  providerLabel: string
  baseUrl: string
  model: string
  modelList: string[]
  temperature: number
  streamEnabled: boolean
  isEnabled: boolean
  apiKeyMask: string
  status: string
  lastTestStatus: string
  lastTestedAt: string | null
  createdAt: string
  updatedAt: string
  grantedByAdminId?: string
}

export type AIProviderCapabilities = {
  streamText: boolean
  toolCalling: boolean
  visionInput: boolean
  reasoningStream: boolean
}

export type AIAvailabilityReason =
  | "ready"
  | "server-secret-missing"
  | "configure-personal-api"
  | "request-access"
  | "grant-paused"
  | "grant-revoked"
  | "request-pending"
  | "request-rejected"

export type AISafeProviderConfig = {
  providerLabel: string
  baseUrl: string
  model: string
  temperature: number
  streamEnabled: boolean
  capabilities: AIProviderCapabilities
}

export type AIResolvedProviderConfig = AISafeProviderConfig & {
  source: Exclude<AIProviderSource, "none">
  apiKey: string
}

export type AIUserConfigSummary = {
  id: string
  name: string
  isActive: boolean
  providerLabel: string
  baseUrl: string
  model: string
  modelList: string[]
  temperature: number
  streamEnabled: boolean
  isEnabled: boolean
  apiKeyMask: string
  lastTestStatus: string
  lastTestedAt: string | null
  createdAt: string
  updatedAt: string
}

export type AIStatusSnapshot = {
  canUseAI: boolean
  source: AIProviderSource
  reason: AIAvailabilityReason
  config: AISafeProviderConfig | null
  configState: {
    storageReady: boolean
    hasUserConfig: boolean
    userConfigEnabled: boolean
    hasGrant: boolean
    grantStatus: string | null
    accessRequestStatus: string | null
  }
}

export type AIConversationListItem = {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  lastMessageAt: string
  messageCount: number
}

export type AIRunMode = "self" | "admin-delegated" | "visible-user"

export type AIRunStepType =
  | "reasoning"
  | "tool_call"
  | "assistant_output"
  | "warning"
  | "skill"

// Real runtime record of which skills were injected this turn and why.
export type ActiveSkillRecord = { id: string; name: string; version: string; triggerReason: string }

export type AIRunStepStatus = "running" | "completed" | "failed"

export type AIRunStepItem = {
  id: string
  type: AIRunStepType
  title: string
  status: AIRunStepStatus
  startedAt: string
  finishedAt: string | null
  summary: string
  inputPreview: unknown
  outputPreview: unknown
  providerMetadata?: Record<string, unknown> | null
  errorMessage: string
}

export type AIMessageStepPreview = Pick<
  AIRunStepItem,
  "id" | "type" | "title" | "status" | "startedAt" | "finishedAt" | "summary" | "errorMessage"
>

export type AIMessageItem = {
  id: string
  role: string
  contentMarkdown: string
  status: string
  reasoningSummary: string
  toolTraceSummary: string
  modelName: string
  providerSource: AIProviderSource
  createdAt: string
  runId: string | null
  runMode: AIRunMode | null
  runStatus: string | null
  delegatedTargetUserId: string | null
  stepsPreview: AIMessageStepPreview[]
  // Skills injected for this turn (real runtime state from the skill step).
  activeSkills: ActiveSkillRecord[]
  attachments: Array<{
    id: string
    uploadId: string | null
    url: string
    originalName: string
    mimeType: string
    size: number
    pdfDocumentId?: string | null
    parseStatus?: string | null
  }>
}

export type AIToolAccessScope = "self" | "admin-delegated" | "visible-user"
export type AIToolSensitivity = "low" | "medium" | "high"

export type AIToolDescriptor = {
  name: string
  title: string
  description: string
  scope: AIToolAccessScope
  inputSchemaSummary: string
  sensitivity: AIToolSensitivity
  auditLabel: string
  whenToUse?: string
  whenNotToUse?: string
  argumentHints?: string[]
  returns?: string
  deprecated?: boolean
  parameterSchema?: Record<string, unknown>
}

export type AIToolResultStatus = "completed" | "failed"

export type AIToolAccessResult = "granted" | "forbidden" | "not_found" | "partial"

export type AIToolStructuredResult<TData = unknown> = {
  ok: boolean
  access: AIToolAccessResult
  summary: string
  data: TData | null
  reason?: string
}

export type AIToolExecutionRecord = {
  name: string
  title: string
  description: string
  input: Record<string, unknown> | null
  result: unknown
  status: AIToolResultStatus
  scope: AIToolAccessScope
  sensitivity: AIToolSensitivity
  auditLabel: string
  error?: string
}

export type AIConversationHistoryEntry = {
  role: "user" | "assistant" | "system"
  content: string
}

export type AIRuntimePlanStep = {
  toolName: string
  reason: string
  input: Record<string, unknown> | null
}

export type AIRuntimePlan = {
  mode: AIRunMode
  delegatedTargetUserId?: string | null
  summary: string
  steps: AIRuntimePlanStep[]
}

export type AIRuntimeResponse = {
  contentMarkdown: string
  reasoningSummary: string
  toolTraceSummary: string
  modelName: string
  toolExecutions: AIToolExecutionRecord[]
  plan: AIRuntimePlan
  compactSteps: AIMessageStepPreview[]
  runSummary: string
  // Set when the run was stopped server-side by a user cancel request. The
  // partial contentMarkdown is preserved; the route finalizes the message as
  // cancelled rather than completed.
  cancelled?: boolean
}

export type AIRunDetail = {
  id: string
  messageId: string
  conversationId: string
  userId: string
  prompt: string
  mode: AIRunMode
  delegatedTargetUserId: string | null
  plannerModel: string
  finalModel: string
  status: string
  summary: string
  createdAt: string
  updatedAt: string
  finishedAt: string | null
  steps: AIRunStepItem[]
}
