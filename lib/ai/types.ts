export type AIProviderSource = "user" | "grant" | "none"

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
}

export type AIResolvedProviderConfig = AISafeProviderConfig & {
  source: Exclude<AIProviderSource, "none">
  apiKey: string
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
  | "run_started"
  | "plan_created"
  | "tool_started"
  | "tool_completed"
  | "tool_failed"
  | "verification_started"
  | "verification_completed"
  | "final_started"
  | "run_completed"
  | "run_failed"

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
  attachments: Array<{
    id: string
    uploadId: string | null
    url: string
    originalName: string
    mimeType: string
    size: number
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
}

export type AIToolResultStatus = "completed" | "failed"

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
