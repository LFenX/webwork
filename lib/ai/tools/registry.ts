import "server-only"
import type { AIToolDefinition } from "@/lib/ai/tools/context"
import { getAdminUserActivityLogTool } from "@/lib/ai/tools/get-admin-user-activity-log"
import { getAdminUserProfileOverviewTool } from "@/lib/ai/tools/get-admin-user-profile-overview"
import { getAdminUserSessionsTool } from "@/lib/ai/tools/get-admin-user-sessions"
import { getMyActivityLogTool } from "@/lib/ai/tools/get-my-activity-log"
import { getMyChatSummaryTool } from "@/lib/ai/tools/get-my-chat-summary"
import { getMyChatThreadMessagesTool } from "@/lib/ai/tools/get-my-chat-thread-messages"
import { getMyChatThreadsOverviewTool } from "@/lib/ai/tools/get-my-chat-threads-overview"
import { getMyFriendsDetailTool } from "@/lib/ai/tools/get-my-friends-detail"
import { getMyFriendsOverviewTool } from "@/lib/ai/tools/get-my-friends-overview"
import { getMyInterviewsOverviewTool } from "@/lib/ai/tools/get-my-interviews-overview"
import { getMyJobsOverviewTool } from "@/lib/ai/tools/get-my-jobs-overview"
import { getMyPostsOverviewTool } from "@/lib/ai/tools/get-my-posts-overview"
import { getMyProfileTool } from "@/lib/ai/tools/get-my-profile"
import { getMyResumeOverviewTool } from "@/lib/ai/tools/get-my-resume-overview"
import { getMySessionsOverviewTool } from "@/lib/ai/tools/get-my-sessions-overview"
import { getMySettingsTool } from "@/lib/ai/tools/get-my-settings"
import { getMyUploadsOverviewTool } from "@/lib/ai/tools/get-my-uploads-overview"
import { getVisibleUserPageOverviewTool } from "@/lib/ai/tools/get-visible-user-page-overview"
import { searchMyChatMessagesTool } from "@/lib/ai/tools/search-my-chat-messages"
import type { AIToolDescriptor } from "@/lib/ai/types"

function defineTool<TInput extends Record<string, unknown> | void>(
  tool: {
    name: string
    title: string
    description: string
    execute: AIToolDefinition<TInput>["execute"]
  },
  meta: Omit<AIToolDescriptor, "name" | "title" | "description">
): AIToolDefinition<TInput> {
  return {
    ...tool,
    ...meta,
  }
}

export const AI_TOOLS_REGISTRY = [
  defineTool(getMyProfileTool, {
    scope: "self",
    inputSchemaSummary: "无需输入",
    sensitivity: "low",
    auditLabel: "read_self_profile",
  }),
  defineTool(getMySettingsTool, {
    scope: "self",
    inputSchemaSummary: "无需输入",
    sensitivity: "low",
    auditLabel: "read_self_settings",
  }),
  defineTool(getMyResumeOverviewTool, {
    scope: "self",
    inputSchemaSummary: "无需输入",
    sensitivity: "medium",
    auditLabel: "read_self_resume",
  }),
  defineTool(getMyJobsOverviewTool, {
    scope: "self",
    inputSchemaSummary: "无需输入",
    sensitivity: "medium",
    auditLabel: "read_self_jobs",
  }),
  defineTool(getMyInterviewsOverviewTool, {
    scope: "self",
    inputSchemaSummary: "无需输入",
    sensitivity: "medium",
    auditLabel: "read_self_interviews",
  }),
  defineTool(getMyPostsOverviewTool, {
    scope: "self",
    inputSchemaSummary: "无需输入",
    sensitivity: "low",
    auditLabel: "read_self_posts",
  }),
  defineTool(getMyUploadsOverviewTool, {
    scope: "self",
    inputSchemaSummary: "无需输入",
    sensitivity: "medium",
    auditLabel: "read_self_uploads",
  }),
  defineTool(getMyFriendsOverviewTool, {
    scope: "self",
    inputSchemaSummary: "无需输入",
    sensitivity: "medium",
    auditLabel: "read_self_friends_overview",
  }),
  defineTool(getMyFriendsDetailTool, {
    scope: "self",
    inputSchemaSummary: "无需输入",
    sensitivity: "medium",
    auditLabel: "read_self_friends_detail",
  }),
  defineTool(getMyChatSummaryTool, {
    scope: "self",
    inputSchemaSummary: "无需输入",
    sensitivity: "high",
    auditLabel: "read_self_chat_summary",
  }),
  defineTool(getMyChatThreadsOverviewTool, {
    scope: "self",
    inputSchemaSummary: "无需输入",
    sensitivity: "high",
    auditLabel: "read_self_chat_threads",
  }),
  defineTool(searchMyChatMessagesTool, {
    scope: "self",
    inputSchemaSummary: "query?: string, peerHint?: string, limit?: number",
    sensitivity: "high",
    auditLabel: "search_self_chat_messages",
  }),
  defineTool(getMyChatThreadMessagesTool, {
    scope: "self",
    inputSchemaSummary: "peerHint?: string, limit?: number",
    sensitivity: "high",
    auditLabel: "read_self_chat_thread",
  }),
  defineTool(getMySessionsOverviewTool, {
    scope: "self",
    inputSchemaSummary: "无需输入",
    sensitivity: "high",
    auditLabel: "read_self_sessions",
  }),
  defineTool(getMyActivityLogTool, {
    scope: "self",
    inputSchemaSummary: "无需输入",
    sensitivity: "high",
    auditLabel: "read_self_activity_log",
  }),
  defineTool(getAdminUserActivityLogTool, {
    scope: "admin-delegated",
    inputSchemaSummary: "targetUserId: string",
    sensitivity: "high",
    auditLabel: "read_admin_user_activity_log",
  }),
  defineTool(getAdminUserSessionsTool, {
    scope: "admin-delegated",
    inputSchemaSummary: "targetUserId: string",
    sensitivity: "high",
    auditLabel: "read_admin_user_sessions",
  }),
  defineTool(getAdminUserProfileOverviewTool, {
    scope: "admin-delegated",
    inputSchemaSummary: "targetUserId: string",
    sensitivity: "medium",
    auditLabel: "read_admin_user_profile_overview",
  }),
  defineTool(getVisibleUserPageOverviewTool, {
    scope: "visible-user",
    inputSchemaSummary: "targetUserId: string",
    sensitivity: "low",
    auditLabel: "read_visible_user_page_overview",
  }),
] as const

export const AI_TOOL_DESCRIPTORS: AIToolDescriptor[] = AI_TOOLS_REGISTRY.map((tool) => ({
  name: tool.name,
  title: tool.title,
  description: tool.description,
  scope: tool.scope,
  inputSchemaSummary: tool.inputSchemaSummary,
  sensitivity: tool.sensitivity,
  auditLabel: tool.auditLabel,
}))

export const AI_TOOL_MAP = new Map(AI_TOOLS_REGISTRY.map((tool) => [tool.name, tool]))
