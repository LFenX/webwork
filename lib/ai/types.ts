export type AIProviderSource = "user" | "grant" | "none"

export type AIAvailabilityReason =
  | "ready"
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
}

export type AIToolDescriptor = {
  name: string
  title: string
  description: string
}

export type AIToolResultStatus = "completed" | "failed"

export type AIToolExecutionRecord = {
  name: string
  title: string
  description: string
  input: Record<string, unknown> | null
  result: unknown
  status: AIToolResultStatus
  error?: string
}

export type AIRuntimeResponse = {
  contentMarkdown: string
  reasoningSummary: string
  toolTraceSummary: string
  modelName: string
  toolExecutions: AIToolExecutionRecord[]
}

export type AIConversationHistoryEntry = {
  role: "user" | "assistant" | "system"
  content: string
}
