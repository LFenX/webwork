import { z } from "zod"
import { SQL_PRACTICE_DIFFICULTIES } from "./constants"

const tagsField = z
  .array(z.string().trim().min(1).max(40))
  .max(20)
  .optional()
  .default([])

export const createPracticeProblemSchema = z.object({
  title: z.string().trim().min(1, "题目名必填").max(200),
  source: z.string().trim().min(1).max(40).default("LeetCode"),
  sourceUrl: z.string().trim().max(500).optional().default(""),
  difficulty: z.enum(SQL_PRACTICE_DIFFICULTIES).default("Medium"),
  tags: tagsField,
  methods: tagsField,
  durationMinutes: z.number().int().min(0).max(24 * 60).optional().default(0),
  notes: z.string().max(2000).optional().default(""),
  code: z.string().max(20000).optional().default(""),
  practicedAt: z.string().datetime().or(z.string().date()).optional(),
})

export const updatePracticeProblemSchema = createPracticeProblemSchema.partial()

export type CreatePracticeProblemInput = z.infer<typeof createPracticeProblemSchema>
export type UpdatePracticeProblemInput = z.infer<typeof updatePracticeProblemSchema>

export const grantUpdateSchema = z.object({
  enabled: z.boolean(),
  note: z.string().max(200).optional().default(""),
})
export type GrantUpdateInput = z.infer<typeof grantUpdateSchema>
