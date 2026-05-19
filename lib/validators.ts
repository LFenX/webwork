import { z } from "zod"
import { JOB_CHANNELS, JOB_STATUS } from "@/lib/enums"
import { VISIBILITY_LEVELS } from "@/lib/visibility"

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

const jobBaseSchema = z.object({
  company: z.string().min(1, "Company is required"),
  position: z.string().min(1, "Position is required"),
  channel: z.string(),
  appliedAt: z.string().datetime().or(z.string().date()),
  status: z.string(),
  notes: z.string().optional().nullable(),
  baseLocation: z.string().optional().nullable(),
  hrContact: z.string().optional().nullable(),
  link: z.string().optional().nullable(),
  jobDescription: z.string().optional().nullable(),
  salaryRange: z.string().optional().nullable(),
  priority: z.number().int().min(0).max(2).optional(),
  nextActionAt: z.string().datetime().nullable().optional(),
  pipelineStage: z.number().int().min(0).max(5).optional(),
})

export const createJobSchema = jobBaseSchema.extend({
  channel: z.string().default(JOB_CHANNELS[0]),
  status: z.string().default(JOB_STATUS[0]),
})

export const updateJobSchema = jobBaseSchema.partial()

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
  visibility: z.enum(VISIBILITY_LEVELS).optional().default("private"),
  folderId: z.string().nullable().optional(),
})

export const updatePostSchema = z.object({
  title: z.string().min(1, "Title is required").optional(),
  summary: z.string().optional(),
  tags: z.array(z.string()).optional(),
  content: z.string().optional(),
  date: z.string().datetime().or(z.string().date()).optional(),
  visibility: z.enum(VISIBILITY_LEVELS).optional(),
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
  mode: z.enum(["markdown", "pdf", "json"]).optional(),
  content: z.string().optional(),
  pdfPath: z.string().optional().nullable(),
  resumeJson: z.unknown().optional().nullable(),
  selectedTheme: z.string().optional().nullable(),
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
  publicSlug: z.string().trim().toLowerCase().max(32).optional().nullable(),
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
  visibility: z.enum(VISIBILITY_LEVELS),
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
  name: z.string().trim().min(1).max(40).optional(),
  providerLabel: z.string().trim().min(1).max(80),
  baseUrl: z.string().trim().url().max(500),
  apiKey: z.string().trim().min(1).max(500),
  model: z.string().trim().min(1).max(120),
  temperature: z.number().min(0).max(2).optional().default(0.7),
  streamEnabled: z.boolean().optional().default(true),
  isEnabled: z.boolean().optional().default(true),
  modelList: z.array(z.string().trim().min(1).max(120)).optional().default([]),
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
  webSearchEnabled: z.boolean().optional().default(false),
  status: z.enum(["active", "paused", "revoked", "deprecated"]).optional().default("active"),
  modelList: z.array(z.string().trim().min(1).max(120)).optional().default([]),
  requestId: z.string().optional(),
  note: z.string().trim().max(500).optional(),
})

export const aiGrantUpsertSchema = aiGrantSchema.extend({
  apiKey: z.string().trim().max(500).optional(),
  status: z.enum(["active", "paused", "revoked", "deprecated"]).optional(),
  webSearch: z.object({
    enabled: z.boolean().optional().default(false),
    apiKey: z.string().trim().max(500).optional(),
    host: z.string().trim().url().max(500),
    workspace: z.string().trim().min(1).max(120).optional().default("default"),
    serviceId: z.string().trim().min(1).max(120).optional().default("ops-web-search-001"),
  }).optional(),
})

export const aiWebSearchConfigSchema = z.object({
  enabled: z.boolean().optional().default(false),
  apiKey: z.string().trim().max(500).optional(),
  host: z.string().trim().url().max(500).optional().or(z.literal("")),
  workspace: z.string().trim().min(1).max(120).optional().default("default"),
  serviceId: z.string().trim().min(1).max(120).optional().default("ops-web-search-001"),
})

export const aiWebSearchTestSchema = z.object({
  query: z.string().trim().min(1).max(300),
  maxResults: z.number().int().min(1).max(10).optional().default(5),
  contentType: z.enum(["snippet", "summary"]).optional().default("snippet"),
  configId: z.string().optional(),
  adminGrantUserId: z.string().optional(),
  webSearch: aiWebSearchConfigSchema.partial().optional(),
})

export const aiConfigActivateSchema = z.object({
  source: z.enum(["self", "admin_grant"]).optional().default("self"),
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
  attachments: z.array(aiAttachmentSchema).max(6).optional().default([]),
  modelOverride: z.string().trim().min(1).max(120).optional(),
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
export type AIGrantUpsertInput = z.infer<typeof aiGrantUpsertSchema>
export type AIWebSearchConfigInput = z.infer<typeof aiWebSearchConfigSchema>
export type AIWebSearchTestInput = z.infer<typeof aiWebSearchTestSchema>
export type AIConfigActivateInput = z.infer<typeof aiConfigActivateSchema>
export type AIRequestReviewInput = z.infer<typeof aiRequestReviewSchema>
export type AIAttachmentInput = z.infer<typeof aiAttachmentSchema>
export type AIStreamInput = z.infer<typeof aiStreamSchema>
export type AIRunsQueryInput = z.infer<typeof aiRunsQuerySchema>

// ── Memory ─────────────────────────────────────────────────────────────────

const VALID_MEMORY_CATEGORIES = ["preference", "project", "decision", "workflow", "bugfix", "content_operation", "other"] as const

export const createMemoryFactSchema = z.object({
  category: z.enum(VALID_MEMORY_CATEGORIES),
  title: z.string().min(1, "标题不能为空"),
  content: z.string().min(1, "内容不能为空"),
  tags: z.array(z.string()).optional().default([]),
  importance: z.enum(["low", "medium", "high"]).optional().default("medium"),
  expiresAt: z.string().nullable().optional(),
})

export const updateMemoryFactSchema = z.object({
  title: z.string().min(1).optional(),
  content: z.string().min(1).optional(),
  category: z.enum(VALID_MEMORY_CATEGORIES).optional(),
  tags: z.array(z.string()).optional(),
  importance: z.enum(["low", "medium", "high"]).optional(),
  expiresAt: z.string().nullable().optional(),
})

export const updateMemorySettingsSchema = z.object({
  enableLongTermMemory: z.boolean().optional(),
  enablePersonaContext: z.boolean().optional(),
  enableConversationArchive: z.boolean().optional(),
  enableToolMemoryEvents: z.boolean().optional(),
  enableMemoryRecall: z.boolean().optional(),
  enableMemoryTools: z.boolean().optional(),
  storeFullConversations: z.boolean().optional(),
  autoTagSensitiveContent: z.boolean().optional(),
  requireConfirmBeforeSave: z.boolean().optional(),
})

export type CreateMemoryFactInput = z.infer<typeof createMemoryFactSchema>
export type UpdateMemoryFactInput = z.infer<typeof updateMemoryFactSchema>
export type UpdateMemorySettingsInput = z.infer<typeof updateMemorySettingsSchema>

export const updateAgentProfileSchema = z.object({
  soulContent: z.string().optional(),
  identityContent: z.string().optional(),
  userContextContent: z.string().optional(),
  rulesContent: z.string().optional(),
  enabled: z.boolean().optional(),
  restoreDefaults: z.boolean().optional(),
  avatarUrl: z.string().trim().max(500).optional().nullable(),
  avatarDataUrl: z.string().max(3_500_000).optional().nullable(),
})

export type UpdateAgentProfileInput = z.infer<typeof updateAgentProfileSchema>

// ── Website Share ─────────────────────────────────────────────────────────

export const createWebsiteResourceSchema = z.object({
  name: z.string().trim().min(1, "网站名称不能为空").max(100, "网站名称最多 100 个字符"),
  url: z.string().trim().url("请输入有效的链接").refine((url) => {
    try {
      const protocol = new URL(url).protocol
      return protocol === "http:" || protocol === "https:"
    } catch { return false }
  }, "仅支持 http/https 链接"),
  description: z.string().trim().max(500, "介绍最多 500 个字符").optional().default(""),
  screenshotUrl: z.string().trim().max(500).regex(/^\/uploads\//, "截图地址格式不正确").optional().nullable(),
  screenshotPositionX: z.number().int().min(0).max(100).optional().default(50),
  screenshotPositionY: z.number().int().min(0).max(100).optional().default(50),
  screenshotScale: z.number().int().min(40).max(240).optional().default(100),
  screenshotFitMode: z.enum(["cover", "contain"]).optional().default("cover"),
  tags: z.array(z.string().trim().min(1).max(30)).max(10, "最多 10 个标签").optional().default([]),
  folderId: z.string().cuid().optional().nullable(),
})

export const updateWebsiteResourceSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  url: z.string().trim().url().refine((url) => {
    try {
      const protocol = new URL(url).protocol
      return protocol === "http:" || protocol === "https:"
    } catch { return false }
  }, "仅支持 http/https 链接").optional(),
  description: z.string().trim().max(500).optional(),
  screenshotUrl: z.string().trim().max(500).regex(/^\/uploads\//).optional().nullable(),
  screenshotPositionX: z.number().int().min(0).max(100).optional(),
  screenshotPositionY: z.number().int().min(0).max(100).optional(),
  screenshotScale: z.number().int().min(40).max(240).optional(),
  screenshotFitMode: z.enum(["cover", "contain"]).optional(),
  tags: z.array(z.string().trim().min(1).max(30)).max(10).optional(),
  folderId: z.string().cuid().optional().nullable(),
})

export const websiteListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  size: z.coerce.number().int().min(1).max(48).optional().default(12),
  q: z.string().trim().max(200).optional(),
  tag: z.string().trim().max(30).optional(),
  folderId: z.string().optional(),
  sharedBy: z.string().optional(),
  sort: z.enum(["latest"]).optional().default("latest"),
})

export const createWebsiteFolderSchema = z.object({
  name: z.string().trim().min(1, "文件夹名称不能为空").max(30, "文件夹名称最多 30 个字符"),
  description: z.string().trim().max(200, "描述最多 200 个字符").optional().default(""),
})

export const updateWebsiteFolderSchema = z.object({
  name: z.string().trim().min(1).max(30).optional(),
  description: z.string().trim().max(200).optional(),
})

export type CreateWebsiteResourceInput = z.infer<typeof createWebsiteResourceSchema>
export type UpdateWebsiteResourceInput = z.infer<typeof updateWebsiteResourceSchema>
export type WebsiteListQueryInput = z.infer<typeof websiteListQuerySchema>
export type CreateWebsiteFolderInput = z.infer<typeof createWebsiteFolderSchema>
export type UpdateWebsiteFolderInput = z.infer<typeof updateWebsiteFolderSchema>
