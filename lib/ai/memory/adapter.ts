import type {
  MemoryFactInput,
  MemoryEventInput,
  MemoryToolEventInput,
  MemoryRecallOptions,
  MemoryRecallResult,
  MemorySettingsUpdateInput,
  MemorySaveResult,
} from "@/lib/ai/memory/types"

export interface MemoryAdapter {
  // Settings
  getOrCreateSettings(userId: string): Promise<{
    enableLongTermMemory: boolean
    enablePersonaContext: boolean
    enableConversationArchive: boolean
    enableToolMemoryEvents: boolean
    enableMemoryRecall: boolean
    enableMemoryTools: boolean
    storeFullConversations: boolean
    autoTagSensitiveContent: boolean
    requireConfirmBeforeSave: boolean
  }>
  updateSettings(userId: string, input: MemorySettingsUpdateInput): Promise<void>

  // MemoryFact
  saveFact(userId: string, input: MemoryFactInput): Promise<MemorySaveResult>
  getFact(userId: string, memoryId: string): Promise<unknown | null>
  updateFact(userId: string, memoryId: string, input: { title?: string; content?: string; category?: string; tags?: string[]; importance?: string; expiresAt?: string | null }): Promise<{ ok: boolean; id?: string; reason?: string }>
  listFacts(userId: string, options?: { category?: string; limit?: number; offset?: number }): Promise<{ items: unknown[]; total: number }>
  searchFacts(userId: string, query: string, options?: { limit?: number }): Promise<unknown[]>
  softDeleteFact(userId: string, memoryId: string): Promise<boolean>

  // MemoryEvent
  saveEvent(userId: string, input: MemoryEventInput): Promise<MemorySaveResult>
  listEvents(userId: string, options?: { limit?: number; offset?: number }): Promise<{ items: unknown[]; total: number }>
  searchEvents(userId: string, query: string, options?: { limit?: number }): Promise<unknown[]>

  // MemoryToolEvent
  saveToolEvent(userId: string, input: MemoryToolEventInput): Promise<MemorySaveResult>
  listToolEvents(userId: string, options?: { limit?: number; offset?: number }): Promise<{ items: unknown[]; total: number }>
  searchToolEvents(userId: string, query: string, options?: { limit?: number }): Promise<unknown[]>

  // Combined search
  search(userId: string, options: MemoryRecallOptions): Promise<MemoryRecallResult>
}
