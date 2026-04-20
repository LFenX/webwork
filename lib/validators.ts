import { z } from "zod"

export const createJobSchema = z.object({
  company: z.string().min(1, "公司名称不能为空"),
  position: z.string().min(1, "职位不能为空"),
  channel: z.string().default("其他"),
  appliedAt: z.string().datetime().or(z.string().date()),
  status: z.string().default("已投递"),
  notes: z.string().optional(),
})

export const updateJobSchema = createJobSchema.partial()

export const createInterviewSchema = z.object({
  company: z.string().min(1, "公司名称不能为空"),
  position: z.string().min(1, "职位不能为空"),
  round: z.string().default("技术一面"),
  format: z.string().default("视频"),
  scheduledAt: z.string().datetime().or(z.string()),
  interviewers: z.string().optional(),
  questions: z.string().optional(),
  selfRating: z.number().int().min(1).max(5).optional().nullable(),
  result: z.string().default("待定"),
  feedback: z.string().optional(),
  jobId: z.string().optional().nullable(),
})

export const updateInterviewSchema = createInterviewSchema.partial()

export type CreateJobInput = z.infer<typeof createJobSchema>
export type UpdateJobInput = z.infer<typeof updateJobSchema>
export type CreateInterviewInput = z.infer<typeof createInterviewSchema>
export type UpdateInterviewInput = z.infer<typeof updateInterviewSchema>
