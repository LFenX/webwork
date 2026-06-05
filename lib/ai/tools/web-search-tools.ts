import "server-only"
import { runWebSearchTool } from "@/lib/web-search"
import type { AIToolDefinition } from "@/lib/ai/tools/context"

type WebSearchInput = {
  query: string
  mode?: "search" | "verify"
  maxResults?: number
  contentType?: "snippet" | "summary"
}

// Merged web tool: the former web_verify_current_info is now `mode: "verify"`,
// which rewrites the query and pulls snippets for time-sensitive checks. One
// tool, one decision (which mode), instead of two near-identical tools.
export const webSearchTool: AIToolDefinition<WebSearchInput> = {
  name: "web_search",
  title: "联网搜索",
  description:
    "搜索互联网信息（热点、新闻、近期趋势、技术资料、产品信息）。当问题涉及最新/现在/今天/当前/价格/版本/政策等可能过时的信息时，传 mode=\"verify\" 进行时效性核验（自动重写查询并取摘要）。",
  scope: "self",
  inputSchemaSummary: 'query: string, mode?: "search"|"verify", maxResults?: number, contentType?: "snippet"|"summary"',
  sensitivity: "medium",
  auditLabel: "web_search",
  whenToUse: "用户要求搜一下/查一下/网上有没有，或问题需要外部网页资料时使用；问题涉及最新、当前、新闻、价格、版本、政策等可能过时的信息时，用 mode=\"verify\"。",
  whenNotToUse: "不要用于站内数据、个人记忆、AI 对话历史、聊天记录、我的文章、群聊、好友聊天等私有数据问题。",
  argumentHints: [
    "query 必填，最多 300 字",
    'mode 可选：search（默认，一般搜索）/ verify（核验最新/当前/价格/版本等时效性信息）',
    "maxResults 默认 5，最大 10",
    "contentType 默认 snippet（verify 模式固定为 snippet）",
  ],
  returns: "联网搜索结果，包含标题、链接、摘要、正文片段和来源位置。结果可能晚于模型内置知识库截止时间，应以来源为准并在回答中展示来源。",
  execute: async (ctx) => {
    const verify = ctx.mode === "verify"
    return runWebSearchTool({
      userId: ctx.userId,
      toolName: "web_search",
      query: ctx.query,
      maxResults: ctx.maxResults,
      contentType: verify ? "snippet" : ctx.contentType,
      queryRewrite: verify,
    })
  },
}
