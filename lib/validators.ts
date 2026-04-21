import { z } from "zod"

export const registerSchema = z.object({
  email: z.string().email("请输入有效的邮箱地址"),
  password: z.string().min(8, "密码至少 8 位"),
  displayName: z.string().min(1, "昵称不能为空").max(50),
})

export const loginSchema = z.object({
  email: z.string().email("请输入有效的邮箱地址"),
  password: z.string().min(1, "请输入密码"),
})

export type RegisterInput = z.infer<typeof registerSchema>
export type LoginInput = z.infer<typeof loginSchema>

export const createJobSchema = z.object({
  company: z.string().min(1, "公司名称不能为空"),
  position: z.string().min(1, "职位不能为空"),
  channel: z.string().default("其他"),
  appliedAt: z.string().datetime().or(z.string().date()),
  status: z.string().default("已投递"),
  notes: z.string().optional().nullable(),
  baseLocation: z.string().optional().nullable(),
  hrContact: z.string().optional().nullable(),
  link: z.string().optional().nullable(),
})

export const updateJobSchema = createJobSchema.partial()

export const createInterviewSchema = z.object({
  company: z.string().min(1, "公司名称不能为空"),
  position: z.string().min(1, "职位不能为空"),
  round: z.string().default("技术一面"),
  format: z.string().default("视频"),
  scheduledAt: z.string().datetime().or(z.string()),
  interviewers: z.string().optional().nullable(),
  questions: z.string().optional().nullable(),
  selfRating: z.number().int().min(1).max(5).optional().nullable(),
  result: z.string().default("待定"),
  feedback: z.string().optional().nullable(),
  jobId: z.string().optional().nullable(),
})

export const updateInterviewSchema = createInterviewSchema.partial()

export const createPostSchema = z.object({
  type: z.enum(["blog", "daily", "reflections", "notes"]),
  slug: z.string().min(1),
  title: z.string().min(1, "标题不能为空"),
  summary: z.string().optional().default(""),
  tags: z.array(z.string()).optional().default([]),
  content: z.string().default(""),
  date: z.string().datetime().or(z.string().date()).optional(),
  visibility: z.enum(["private", "friends", "public"]).optional().default("private"),
})

export const updatePostSchema = createPostSchema.omit({ type: true, slug: true }).partial()

export const resumeSchema = z.object({
  mode: z.enum(["markdown", "pdf"]).optional(),
  content: z.string().optional(),
  pdfPath: z.string().optional().nullable(),
})

export const siteSettingsSchema = z.object({
  ownerName: z.string().min(1).optional(),
  heroTagline: z.string().optional(),
})

export type CreateJobInput = z.infer<typeof createJobSchema>
export type UpdateJobInput = z.infer<typeof updateJobSchema>
export type CreateInterviewInput = z.infer<typeof createInterviewSchema>
export type UpdateInterviewInput = z.infer<typeof updateInterviewSchema>
export type CreatePostInput = z.infer<typeof createPostSchema>
export type UpdatePostInput = z.infer<typeof updatePostSchema>
