export const MEMORY_CATEGORIES = [
  "preference",
  "project",
  "decision",
  "workflow",
  "bugfix",
  "content_operation",
  "other",
] as const

export type MemoryCategory = (typeof MEMORY_CATEGORIES)[number]

export const MEMORY_IMPORTANCE = ["low", "medium", "high"] as const
export type MemoryImportance = (typeof MEMORY_IMPORTANCE)[number]

export const MEMORY_SOURCES = ["manual", "conversation", "tool_operation"] as const
export type MemorySource = (typeof MEMORY_SOURCES)[number]

export interface MemoryFactInput {
  category?: string
  title: string
  content: string
  tags?: string[]
  importance?: string
  source?: string
  sourceConversationId?: string | null
  sourceToolCallLogId?: string | null
  expiresAt?: string | null
}

export interface MemoryEventInput {
  conversationId?: string | null
  messageId?: string | null
  topicSummary: string
  keyTakeaways?: string
  relatedModules?: string[]
  keywords?: string[]
  importance?: string
  sensitive?: boolean
}

export interface MemoryToolEventInput {
  action: string
  module?: string | null
  title?: string | null
  articleId?: string | null
  folderId?: string | null
  folderName?: string | null
  sourceModule?: string | null
  targetModule?: string | null
  slugChanged?: boolean | null
  changedFields?: string[]
  sourceToolCallLogId?: string | null
}

export interface MemoryRecallOptions {
  query: string
  categories?: string[]
  limit?: number
  includeEvent?: boolean
  includeToolEvent?: boolean
}

export interface MemoryFactItem {
  type: "fact"
  id: string
  category: string
  title: string
  content: string
  tags: string[]
  source: string
  importance: string
  createdAt: string
}

export interface MemoryEventItem {
  type: "event"
  id: string
  topicSummary: string
  keyTakeaways: string
  relatedModules: string[]
  keywords: string[]
  importance: string
  createdAt: string
}

export interface MemoryToolEventItem {
  type: "tool_event"
  id: string
  action: string
  module: string | null
  title: string | null
  articleId: string | null
  folderId: string | null
  createdAt: string
}

export type MemoryRecallItem = MemoryFactItem | MemoryEventItem | MemoryToolEventItem

export interface MemoryRecallResult {
  items: MemoryRecallItem[]
  skipped: boolean
  reason?: string
}

export interface MemorySettingsUpdateInput {
  enableLongTermMemory?: boolean
  enablePersonaContext?: boolean
  enableConversationArchive?: boolean
  enableToolMemoryEvents?: boolean
  enableMemoryRecall?: boolean
  enableMemoryTools?: boolean
  storeFullConversations?: boolean
  autoTagSensitiveContent?: boolean
  requireConfirmBeforeSave?: boolean
}

export interface MemorySaveResult {
  ok: boolean
  id?: string
  skipped?: boolean
  reason?: string
}
