import "server-only"
import { getMyChatSummaryTool } from "@/lib/ai/tools/get-my-chat-summary"
import { getMyFriendsOverviewTool } from "@/lib/ai/tools/get-my-friends-overview"
import { getMyInterviewsOverviewTool } from "@/lib/ai/tools/get-my-interviews-overview"
import { getMyJobsOverviewTool } from "@/lib/ai/tools/get-my-jobs-overview"
import { getMyPostsOverviewTool } from "@/lib/ai/tools/get-my-posts-overview"
import { getMyProfileTool } from "@/lib/ai/tools/get-my-profile"
import { getMyResumeOverviewTool } from "@/lib/ai/tools/get-my-resume-overview"
import { getMySettingsTool } from "@/lib/ai/tools/get-my-settings"
import { getMyUploadsOverviewTool } from "@/lib/ai/tools/get-my-uploads-overview"
import { getVisibleUserPageOverviewTool } from "@/lib/ai/tools/get-visible-user-page-overview"
import type { AIToolDescriptor } from "@/lib/ai/types"

export const AI_TOOLS_REGISTRY = [
  getMyProfileTool,
  getMySettingsTool,
  getMyResumeOverviewTool,
  getMyJobsOverviewTool,
  getMyInterviewsOverviewTool,
  getMyPostsOverviewTool,
  getMyUploadsOverviewTool,
  getMyFriendsOverviewTool,
  getMyChatSummaryTool,
  getVisibleUserPageOverviewTool,
] as const

export const AI_TOOL_DESCRIPTORS: AIToolDescriptor[] = AI_TOOLS_REGISTRY.map((tool) => ({
  name: tool.name,
  title: tool.title,
  description: tool.description,
}))

export const AI_TOOL_MAP = new Map(AI_TOOLS_REGISTRY.map((tool) => [tool.name, tool]))
