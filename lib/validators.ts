import { z } from "zod"

export const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email("Please enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  displayName: z.string().trim().min(1, "Display name is required").max(50),
})

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Please enter a valid email address"),
  password: z.string().min(1, "Please enter your password"),
})

export type RegisterInput = z.infer<typeof registerSchema>
export type LoginInput = z.infer<typeof loginSchema>

export const createJobSchema = z.object({
  company: z.string().min(1, "Company is required"),
  position: z.string().min(1, "Position is required"),
  channel: z.string().default("Other"),
  appliedAt: z.string().datetime().or(z.string().date()),
  status: z.string().default("Applied"),
  notes: z.string().optional().nullable(),
  baseLocation: z.string().optional().nullable(),
  hrContact: z.string().optional().nullable(),
  link: z.string().optional().nullable(),
})

export const updateJobSchema = createJobSchema.partial()

export const createInterviewSchema = z.object({
  company: z.string().min(1, "Company is required"),
  position: z.string().min(1, "Position is required"),
  round: z.string().default("Technical Round 1"),
  format: z.string().default("Video"),
  scheduledAt: z.string().datetime().or(z.string()),
  interviewers: z.string().optional().nullable(),
  questions: z.string().optional().nullable(),
  selfRating: z.number().int().min(1).max(5).optional().nullable(),
  result: z.string().default("Pending"),
  feedback: z.string().optional().nullable(),
  jobId: z.string().optional().nullable(),
})

export const updateInterviewSchema = createInterviewSchema.partial()

export const createPostSchema = z.object({
  type: z.enum(["blog", "daily", "reflections", "notes"]),
  slug: z.string().min(1),
  title: z.string().min(1, "Title is required"),
  summary: z.string().optional().default(""),
  tags: z.array(z.string()).optional().default([]),
  content: z.string().default(""),
  date: z.string().datetime().or(z.string().date()).optional(),
  visibility: z.enum(["private", "friends"]).optional().default("private"),
  folderId: z.string().nullable().optional(),
})

export const updatePostSchema = z.object({
  title: z.string().min(1, "Title is required").optional(),
  summary: z.string().optional(),
  tags: z.array(z.string()).optional(),
  content: z.string().optional(),
  date: z.string().datetime().or(z.string().date()).optional(),
  visibility: z.enum(["private", "friends"]).optional(),
  folderId: z.string().nullable().optional(),
})

export const articleFolderSchema = z.object({
  type: z.enum(["blog", "daily", "reflections", "notes"]),
  name: z.string().trim().min(1, "Folder name is required").max(60),
  description: z.string().trim().max(200).optional().default(""),
  coverImageUrl: z.string().trim().max(500).optional().default(""),
  coverPositionX: z.number().int().min(0).max(100).optional().default(50),
  coverPositionY: z.number().int().min(0).max(100).optional().default(50),
  coverOpacity: z.number().int().min(0).max(100).optional().default(100),
  coverFitMode: z.enum(["auto", "manual"]).optional().default("auto"),
  coverScale: z.number().int().min(40).max(240).optional().default(100),
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
  language: z.enum(["zh-CN", "en-US"]).optional(),
})

export const passwordChangeRequestSchema = z.object({
  email: z.string().trim().toLowerCase().email().optional(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string().min(8, "Password confirmation must be at least 8 characters"),
}).refine((value) => value.password === value.confirmPassword, {
  path: ["confirmPassword"],
  message: "Passwords do not match",
})

export const moduleVisibilitySchema = z.object({
  module: z.enum(["home", "resume", "blog", "daily", "reflections", "notes", "jobs", "interviews"]),
  visibility: z.enum(["private", "friends"]),
})

export const commentSchema = z.object({
  content: z.string().trim().max(1000, "Comment must be under 1000 characters").default(""),
  parentId: z.string().min(1).optional().nullable(),
  stickerId: z.string().min(1).optional().nullable(),
  stickerEmoji: z.string().trim().max(20).optional().nullable(),
})

export const guestbookMessageSchema = z.object({
  ownerId: z.string().min(1),
  content: z.string().trim().max(500, "Message must be under 500 characters").default(""),
  parentId: z.string().min(1).optional().nullable(),
  stickerId: z.string().min(1).optional().nullable(),
  stickerEmoji: z.string().trim().max(20).optional().nullable(),
})

export const announcementSchema = z.object({
  content: z.string().trim().min(1, "Announcement is required").max(500, "Announcement must be under 500 characters"),
})

export const channelCreateSchema = z.object({
  name: z.string().trim().min(1, "Channel name is required").max(60, "Channel name must be under 60 characters"),
  memberIds: z.array(z.string().min(1)).default([]),
})

export const channelInviteSchema = z.object({
  memberIds: z.array(z.string().min(1)).min(1, "Select at least one friend"),
})

export const channelManageSchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  announcement: z.string().trim().max(500).optional(),
})

export const uploadQuerySchema = z.object({
  postId: z.string().cuid().optional(),
})

export const aiConversationCreateSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
})

export const aiConversationUpdateSchema = z.object({
  title: z.string().trim().min(1).max(120),
})

export const aiProviderConfigSchema = z.object({
  providerLabel: z.string().trim().min(1).max(80),
  baseUrl: z.string().trim().url().max(500),
  apiKey: z.string().trim().min(1).max(500),
  model: z.string().trim().min(1).max(120),
  temperature: z.number().min(0).max(2).optional().default(0.7),
  streamEnabled: z.boolean().optional().default(true),
  isEnabled: z.boolean().optional().default(true),
})

export const aiProviderConfigUpdateSchema = aiProviderConfigSchema.partial()

export const aiAccessRequestSchema = z.object({
  message: z.string().trim().min(1).max(500),
})

export const aiGrantSchema = z.object({
  providerLabel: z.string().trim().min(1).max(80),
  baseUrl: z.string().trim().url().max(500),
  apiKey: z.string().trim().min(1).max(500),
  model: z.string().trim().min(1).max(120),
  temperature: z.number().min(0).max(2).optional().default(0.7),
  streamEnabled: z.boolean().optional().default(true),
  status: z.enum(["active", "paused"]).optional().default("active"),
})

export const aiRequestReviewSchema = z.object({
  reviewNote: z.string().trim().max(500).optional().default(""),
})

export const aiAttachmentSchema = z.object({
  uploadId: z.string().cuid().optional().nullable(),
  url: z.string().trim().min(1).max(500),
  originalName: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(1).max(120),
  size: z.number().int().min(0).max(20 * 1024 * 1024),
})

export const aiStreamSchema = z.object({
  conversationId: z.string().cuid().optional(),
  prompt: z.string().trim().min(1).max(10000),
  attachments: z.array(aiAttachmentSchema).max(1).optional().default([]),
})

export const aiRunsQuerySchema = z.object({
  includeSteps: z.coerce.boolean().optional().default(true),
})

export type CreateJobInput = z.infer<typeof createJobSchema>
export type UpdateJobInput = z.infer<typeof updateJobSchema>
export type CreateInterviewInput = z.infer<typeof createInterviewSchema>
export type UpdateInterviewInput = z.infer<typeof updateInterviewSchema>
export type CreatePostInput = z.infer<typeof createPostSchema>
export type UpdatePostInput = z.infer<typeof updatePostSchema>
export type AIConversationCreateInput = z.infer<typeof aiConversationCreateSchema>
export type AIConversationUpdateInput = z.infer<typeof aiConversationUpdateSchema>
export type AIProviderConfigInput = z.infer<typeof aiProviderConfigSchema>
export type AIProviderConfigUpdateInput = z.infer<typeof aiProviderConfigUpdateSchema>
export type AIAccessRequestInput = z.infer<typeof aiAccessRequestSchema>
export type AIGrantInput = z.infer<typeof aiGrantSchema>
export type AIRequestReviewInput = z.infer<typeof aiRequestReviewSchema>
export type AIAttachmentInput = z.infer<typeof aiAttachmentSchema>
export type AIStreamInput = z.infer<typeof aiStreamSchema>
export type AIRunsQueryInput = z.infer<typeof aiRunsQuerySchema>
