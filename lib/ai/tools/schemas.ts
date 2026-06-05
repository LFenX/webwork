import "server-only"
import { z } from "zod"

// ───────────────────────────────────────────────────────────────────────────
// zod input-schema catalog (migration staging ground).
//
// These are the authoritative zod schemas for the tools whose parameter schema
// currently lives in the runtime.ts `toolParametersSchema` switch (the bare
// convention-A tools plus web_search/web_verify). Phase 0 proves — via
// scripts/check-tool-schema-parity.ts — that z.toJSONSchema() of each entry is
// byte-equivalent to the legacy switch output (including per-field
// descriptions), so the switch can be deleted safely in Phase 2. In Phase 2
// each schema moves onto its tool's defineTool().
//
// Tools that already carry an inline parameterSchema (PDF, knowledge, LaTeX,
// channels, memory-batch, capabilities, roundtable, etc.) carry their own JSON
// Schema (rawParameterSchema) and are not listed here.
// ───────────────────────────────────────────────────────────────────────────

const postType = z.enum(["blog", "daily", "reflections", "notes"])
const visibility = z.enum(["private", "friends", "public"])
const memoryCategory = z.enum(["preference", "project", "decision", "workflow", "bugfix", "content_operation", "other"])

const targetUserIdVisible = z.string().describe("Target user id for visible-user tools.")

// Shared empty-input schema for the no-parameter tools (the switch `default`
// case → {type:"object", properties:{}, additionalProperties:false}).
export const EMPTY_INPUT = z.object({})

export const TOOL_INPUT_SCHEMAS: Record<string, z.ZodType> = {
  // ── No-input (switch default) ──────────────────────────────────────────────
  get_my_profile: EMPTY_INPUT,
  get_my_permissions: EMPTY_INPUT,
  get_my_module_visibility: EMPTY_INPUT,
  get_my_settings: EMPTY_INPUT,
  get_my_home_overview: EMPTY_INPUT,
  get_my_resume_overview: EMPTY_INPUT,
  get_my_resume_detail: EMPTY_INPUT,
  get_my_resume_versions: EMPTY_INPUT,
  get_my_posts_overview: EMPTY_INPUT,
  get_my_jobs_overview: EMPTY_INPUT,
  get_my_interviews_overview: EMPTY_INPUT,
  get_my_uploads_overview: EMPTY_INPUT,
  get_my_friends_overview: EMPTY_INPUT,
  get_my_friends_detail: EMPTY_INPUT,
  get_my_chat_summary: EMPTY_INPUT,
  get_my_chat_threads_overview: EMPTY_INPUT,
  get_my_sessions_overview: EMPTY_INPUT,
  get_my_activity_log: EMPTY_INPUT,
  get_admin_self_permissions: EMPTY_INPUT,
  get_admin_overview: EMPTY_INPUT,
  // Fixed: list_my_friends accepts a limit (default 30, max 100) that the legacy
  // switch never advertised to the model. Now exposed + validated.
  list_my_friends: z.object({
    limit: z.number().int().min(1).max(100).optional(),
  }),

  // ── Chat ────────────────────────────────────────────────────────────────────
  search_my_chat_messages: z.object({
    query: z.string().describe("Keyword query for chat message search.").optional(),
    peerHint: z.string().describe("Optional peer identifier, email, or display name.").optional(),
    limit: z.number().int().min(1).max(20).optional(),
  }),
  get_my_chat_thread_messages: z.object({
    peerHint: z.string().describe("Peer identifier, email, or display name.").optional(),
    limit: z.number().int().min(1).max(30).optional(),
  }),

  // ── Friends ──────────────────────────────────────────────────────────────────
  get_my_friend_profile: z.object({
    friendId: z.string().describe("Friend user id.").optional(),
    friendHint: z.string().describe("Friend nickname, email, or fuzzy hint.").optional(),
  }),

  // ── Posts (self + visible-user share the schema in the switch) ───────────────
  list_my_posts: z.object({
    targetUserId: targetUserIdVisible.optional(),
    postType: postType.optional(),
    query: z.string().describe("Optional keyword filter.").optional(),
    limit: z.number().int().min(1).max(50).optional(),
  }),
  list_visible_user_posts: z.object({
    targetUserId: targetUserIdVisible.optional(),
    postType: postType.optional(),
    query: z.string().describe("Optional keyword filter.").optional(),
    limit: z.number().int().min(1).max(50).optional(),
  }),
  search_my_posts: z.object({
    query: z.string().describe("Keyword query for post search."),
    postType: postType.optional(),
    limit: z.number().int().min(1).max(30).optional(),
  }),
  get_my_post_detail: z.object({
    targetUserId: targetUserIdVisible.optional(),
    postId: z.string().describe("Post id.").optional(),
    slug: z.string().describe("Post slug.").optional(),
    postType: postType.optional(),
  }),
  get_my_post_content: z.object({
    targetUserId: targetUserIdVisible.optional(),
    postId: z.string().describe("Post id.").optional(),
    slug: z.string().describe("Post slug.").optional(),
    postType: postType.optional(),
  }),
  get_visible_user_post_content: z.object({
    targetUserId: targetUserIdVisible.optional(),
    postId: z.string().describe("Post id.").optional(),
    slug: z.string().describe("Post slug.").optional(),
    postType: postType.optional(),
  }),

  // ── Jobs ─────────────────────────────────────────────────────────────────────
  list_my_jobs: z.object({
    targetUserId: targetUserIdVisible.optional(),
    status: z.string().optional(),
    query: z.string().optional(),
    limit: z.number().int().min(1).max(50).optional(),
  }),
  list_visible_user_jobs: z.object({
    targetUserId: targetUserIdVisible.optional(),
    status: z.string().optional(),
    query: z.string().optional(),
    limit: z.number().int().min(1).max(50).optional(),
  }),
  get_my_job_detail: z.object({
    targetUserId: targetUserIdVisible.optional(),
    jobId: z.string().describe("Job record id."),
  }),
  get_visible_user_job_detail: z.object({
    targetUserId: targetUserIdVisible.optional(),
    jobId: z.string().describe("Job record id."),
  }),

  // ── Interviews ───────────────────────────────────────────────────────────────
  list_my_interviews: z.object({
    targetUserId: targetUserIdVisible.optional(),
    result: z.string().optional(),
    query: z.string().optional(),
    limit: z.number().int().min(1).max(50).optional(),
  }),
  list_visible_user_interviews: z.object({
    targetUserId: targetUserIdVisible.optional(),
    result: z.string().optional(),
    query: z.string().optional(),
    limit: z.number().int().min(1).max(50).optional(),
  }),
  get_my_interview_detail: z.object({
    targetUserId: targetUserIdVisible.optional(),
    interviewId: z.string().describe("Interview record id."),
  }),
  get_visible_user_interview_detail: z.object({
    targetUserId: targetUserIdVisible.optional(),
    interviewId: z.string().describe("Interview record id."),
  }),

  // ── Visible-user / admin single-target reads ─────────────────────────────────
  get_visible_user_permissions: z.object({ targetUserId: z.string().describe("Target user id.") }),
  get_visible_user_home_overview: z.object({ targetUserId: z.string().describe("Target user id.") }),
  get_visible_user_resume_detail: z.object({ targetUserId: z.string().describe("Target user id.") }),
  get_admin_user_detail: z.object({ targetUserId: z.string().describe("Target user id.") }),

  // ── Admin lists ──────────────────────────────────────────────────────────────
  list_admin_user_activity_logs: z.object({
    targetUserId: z.string().describe("Target user id."),
    limit: z.number().int().min(1).max(50).optional(),
    cursor: z.string().optional(),
  }),
  list_admin_user_sessions: z.object({
    targetUserId: z.string().describe("Target user id."),
    limit: z.number().int().min(1).max(50).optional(),
    cursor: z.string().optional(),
  }),
  list_admin_ai_access_requests: z.object({
    limit: z.number().int().min(1).max(50).optional(),
    cursor: z.string().optional(),
    query: z.string().optional(),
    status: z.string().optional(),
  }),
  list_admin_ai_grants: z.object({
    limit: z.number().int().min(1).max(50).optional(),
    cursor: z.string().optional(),
    query: z.string().optional(),
    status: z.string().optional(),
  }),
  list_admin_users: z.object({
    limit: z.number().int().min(1).max(50).optional(),
    cursor: z.string().optional(),
    query: z.string().optional(),
    status: z.string().optional(),
  }),
  list_admin_ai_audit_logs: z.object({
    targetUserId: z.string().describe("Optional target user id filter.").optional(),
    limit: z.number().int().min(1).max(50).optional(),
    cursor: z.string().optional(),
  }),

  // ── Markdown content management ──────────────────────────────────────────────
  create_markdown_article: z.object({
    module: postType.describe("Content module."),
    title: z.string().describe("Article title. Required, non-empty."),
    content: z.string().describe("Markdown body content.").optional(),
    summary: z.string().describe("Short summary.").optional(),
    tags: z.array(z.string()).describe("Tags array.").optional(),
    folderId: z.string().describe("Optional folder id. Omit or pass null for root.").optional(),
    visibility: visibility.describe("Visibility, defaults to private.").optional(),
    date: z.string().describe("ISO date string.").optional(),
  }),
  update_markdown_article: z.object({
    module: postType.describe("Content module the article belongs to."),
    articleId: z.string().describe("Article id to update."),
    title: z.string().describe("New title.").optional(),
    content: z.string().describe("New body content. Must not be empty string.").optional(),
    summary: z.string().describe("New summary.").optional(),
    tags: z.array(z.string()).describe("New tags array.").optional(),
    folderId: z.string().describe("Move to folder id. Pass null to move to root. Omit to leave unchanged.").optional(),
    visibility: visibility.describe("New visibility.").optional(),
    date: z.string().describe("New ISO date string.").optional(),
  }),
  get_markdown_article_detail: z.object({
    module: postType.describe("Content module."),
    articleId: z.string().describe("Article id.").optional(),
    slug: z.string().describe("Article slug.").optional(),
  }),
  list_markdown_articles: z.object({
    module: postType.describe("Content module."),
    folderId: z.string().describe("Optional folder id filter. Omit to list all, null for root.").optional(),
    keyword: z.string().describe("Optional keyword search.").optional(),
    limit: z.number().int().min(1).max(30).optional(),
  }),
  create_content_folder: z.object({
    module: postType.describe("Content module."),
    name: z.string().describe("Folder name. Required, non-empty."),
    description: z.string().describe("Optional folder description.").optional(),
  }),
  list_content_folders: z.object({ module: postType.describe("Content module.") }),
  move_article_to_folder: z.object({
    sourceModule: postType.describe("The module the article currently belongs to."),
    articleId: z.string().describe("Article id to move."),
    targetModule: postType.describe("Target module. Defaults to sourceModule for same-module moves.").optional(),
    targetFolderId: z.string().describe("Target folder id. Pass null to move to root. Omit to keep current folder.").optional(),
    confirmedByUser: z.boolean().describe("Required to be true for cross-module moves (sourceModule !== targetModule).").optional(),
  }),

  // ── Memory ───────────────────────────────────────────────────────────────────
  save_user_memory: z.object({
    category: memoryCategory.describe("Memory category."),
    title: z.string().describe("Short title for the memory."),
    content: z.string().describe("Memory content. Do NOT store full article bodies or full conversation transcripts."),
    tags: z.array(z.string()).describe("Tags array.").optional(),
    importance: z.enum(["low", "medium", "high"]).describe("Importance, defaults to medium.").optional(),
    expiresAt: z.string().describe("Optional ISO date for expiration.").optional(),
  }),
  search_user_memory: z.object({
    query: z.string().describe("Search query."),
    category: memoryCategory.describe("Optional category filter.").optional(),
    limit: z.number().int().min(1).max(20).optional(),
  }),
  list_user_memories: z.object({
    category: memoryCategory.describe("Optional category filter.").optional(),
    limit: z.number().int().min(1).max(50).optional(),
  }),
  forget_user_memory: z.object({
    memoryId: z.string().describe("MemoryFact id to delete."),
    confirmedByUser: z.boolean().describe("Must be true to execute deletion. If false or absent, only returns confirmation prompt.").optional(),
  }),

  // ── Persona ──────────────────────────────────────────────────────────────────
  update_agent_profile: z.object({
    section: z.enum(["identity", "soul", "user", "rules"]).describe("Which AgentProfile section to update."),
    operation: z.enum(["append", "replace_section", "rewrite"]).describe("How to apply the content. Default: append. replace_section/rewrite need confirmation.").optional(),
    content: z.string().describe("The new content to write or append. Must be concise and structured. Do NOT paste full conversation transcripts."),
    reason: z.string().describe("Why this update is being made — for audit purposes.").optional(),
    confirmedByUser: z.boolean().describe("Required true for high-impact changes (rules modifications, rewrites).").optional(),
  }),

  // ── Web search (merged: verify is now a mode) ────────────────────────────────
  web_search: z.object({
    query: z.string().describe("Internet search query, max 300 characters."),
    mode: z.enum(["search", "verify"]).describe('search = general web search; verify = time-sensitive check (rewrites query, snippet results).').optional(),
    maxResults: z.number().int().min(1).max(10).optional(),
    contentType: z.enum(["snippet", "summary"]).optional(),
  }),
}
