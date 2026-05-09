import { z } from "zod"
import { GUARDIAN_SERVER_EVENT_TYPES } from "@/lib/sql-guardian/server/events"
import {
  GUARDIAN_MEMORY_STATUSES,
  GUARDIAN_MEMORY_TYPES,
} from "@/lib/sql-guardian/server/memory-safety"

const ALLOWED_MOODS = [
  "calm",
  "curious",
  "focused",
  "sleepy",
  "excited",
  "confused",
  "proud",
] as const

const MAX_JSON_CHARS = 4_000

function assertSmallJson(value: unknown, ctx: z.RefinementCtx) {
  if (value === undefined) return
  try {
    const json = JSON.stringify(value)
    if (!json || json.length > MAX_JSON_CHARS) {
      ctx.addIssue({
        code: "custom",
        message: `JSON payload must be under ${MAX_JSON_CHARS} characters`,
      })
    }
  } catch {
    ctx.addIssue({
      code: "custom",
      message: "Value must be JSON serializable",
    })
  }
}

export function normalizeJsonInput(value: unknown) {
  if (value === undefined) return undefined
  return JSON.parse(JSON.stringify(value)) as unknown
}

export const guardianPreferencesSchema = z.object({
  dockMode: z.enum(["floating", "docked", "compact", "minimized"]).optional(),
  reducedMotionAware: z.boolean().optional(),
  autoBubbleInSqlLab: z.boolean().optional(),
  guardianMemoryEnabled: z.boolean().optional(),
}).strict()

export const updateGuardianProfileSchema = z.object({
  name: z.string().trim().min(1).max(20).optional(),
  mood: z.enum(ALLOWED_MOODS).optional(),
  preferencesJson: guardianPreferencesSchema.optional(),
}).strict()

export const createGuardianEventSchema = z.object({
  eventType: z.enum(GUARDIAN_SERVER_EVENT_TYPES),
  source: z.string().trim().max(80).optional(),
  pagePath: z.string().trim().max(200).optional(),
  eventPayloadJson: z.unknown().optional().superRefine(assertSmallJson),
}).strict()

export const guardianEventsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(30),
  cursor: z.string().trim().min(1).max(120).optional(),
})

export const guardianChatSchema = z.object({
  message: z.string().trim().min(1).max(1000),
  pagePath: z.string().trim().max(200).optional(),
}).strict()

export const guardianDialoguesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(20).optional().default(12),
})

const guardianMemoryStatusSchema = z.enum(GUARDIAN_MEMORY_STATUSES)

export const guardianMemoriesQuerySchema = z.object({
  status: z.preprocess((value) => {
    if (typeof value !== "string" || !value.trim()) return undefined
    return value.split(",").map((item) => item.trim()).filter(Boolean)
  }, z.array(guardianMemoryStatusSchema).max(4).optional().default(["active", "candidate"])),
  type: z.enum(GUARDIAN_MEMORY_TYPES).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(30),
})

export const createGuardianMemorySchema = z.object({
  type: z.enum(GUARDIAN_MEMORY_TYPES),
  content: z.string().trim().min(1).max(500),
  summary: z.string().trim().max(160).optional(),
  importance: z.coerce.number().int().min(1).max(5).optional().default(1),
}).strict()

export const updateGuardianMemorySchema = z.object({
  type: z.enum(GUARDIAN_MEMORY_TYPES).optional(),
  status: guardianMemoryStatusSchema.optional(),
  content: z.string().trim().min(1).max(500).optional(),
  summary: z.string().trim().max(160).nullable().optional(),
  importance: z.coerce.number().int().min(1).max(5).optional(),
}).strict()

export type UpdateGuardianProfileInput = z.infer<typeof updateGuardianProfileSchema>
export type CreateGuardianEventInput = z.infer<typeof createGuardianEventSchema>
export type GuardianEventsQueryInput = z.infer<typeof guardianEventsQuerySchema>
export type GuardianChatInput = z.infer<typeof guardianChatSchema>
export type GuardianDialoguesQueryInput = z.infer<typeof guardianDialoguesQuerySchema>
export type GuardianMemoriesQueryInput = z.infer<typeof guardianMemoriesQuerySchema>
export type CreateGuardianMemoryInput = z.infer<typeof createGuardianMemorySchema>
export type UpdateGuardianMemoryInput = z.infer<typeof updateGuardianMemorySchema>
