import { z } from "zod"

export const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email("请输入有效的邮箱地址"),
  password: z.string().min(8, "密码至少 8 位"),
  displayName: z.string().trim().min(1, "昵称不能为空").max(50),
})

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("请输入有效的邮箱地址"),
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
  visibility: z.enum(["private", "friends"]).optional().default("private"),
  folderId: z.string().nullable().optional(),
})

export const updatePostSchema = z.object({
  title: z.string().min(1, "鏍囬涓嶈兘涓虹┖").optional(),
  summary: z.string().optional(),
  tags: z.array(z.string()).optional(),
  content: z.string().optional(),
  date: z.string().datetime().or(z.string().date()).optional(),
  visibility: z.enum(["private", "friends"]).optional(),
  folderId: z.string().nullable().optional(),
})

export const articleFolderSchema = z.object({
  type: z.enum(["blog", "daily", "reflections", "notes"]),
  name: z.string().trim().min(1, "文件夹名称不能为空").max(60),
  description: z.string().trim().max(200).optional().default(""),
  coverImageUrl: z.string().trim().max(500).optional().default(""),
})

export const updateArticleFolderSchema = articleFolderSchema.omit({ type: true }).partial()

export const resumeSchema = z.object({
  mode: z.enum(["markdown", "pdf"]).optional(),
  content: z.string().optional(),
  pdfPath: z.string().optional().nullable(),
})

export const siteSettingsSchema = z.object({
  ownerName: z.string().min(1).optional(),
  heroTagline: z.string().optional(),
  displayName: z.string().trim().min(1).max(50).optional(),
  avatarText: z.string().trim().max(20).optional(),
  avatarUrl: z.string().trim().max(500).optional().nullable(),
  avatarDataUrl: z.string().max(2_500_000).optional().nullable(),
  location: z.string().trim().max(80).optional(),
  bio: z.string().trim().max(200).optional(),
  email: z.string().trim().toLowerCase().email().optional(),
})

export const passwordChangeRequestSchema = z.object({
  email: z.string().trim().toLowerCase().email().optional(),
  password: z.string().min(8, "密码至少 8 位"),
})

export const moduleVisibilitySchema = z.object({
  module: z.enum(["home", "resume", "blog", "daily", "reflections", "notes", "jobs", "interviews"]),
  visibility: z.enum(["private", "friends"]),
})

export const commentSchema = z.object({
  content: z.string().trim().min(1, "评论不能为空").max(1000, "评论不能超过 1000 字"),
})

export const guestbookMessageSchema = z.object({
  ownerId: z.string().min(1),
  content: z.string().trim().min(1, "留言不能为空").max(500, "留言不能超过 500 字"),
})

export const uploadQuerySchema = z.object({
  postId: z.string().cuid().optional(),
})

export type CreateJobInput = z.infer<typeof createJobSchema>
export type UpdateJobInput = z.infer<typeof updateJobSchema>
export type CreateInterviewInput = z.infer<typeof createInterviewSchema>
export type UpdateInterviewInput = z.infer<typeof updateInterviewSchema>
export type CreatePostInput = z.infer<typeof createPostSchema>
export type UpdatePostInput = z.infer<typeof updatePostSchema>
