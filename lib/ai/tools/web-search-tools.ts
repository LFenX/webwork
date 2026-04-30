import "server-only"
import { runWebSearchTool } from "@/lib/web-search"
import type { AIToolDefinition } from "@/lib/ai/tools/context"

type WebSearchInput = {
  query: string
  maxResults?: number
  contentType?: "snippet" | "summary"
  queryRewrite?: boolean
}

type WebVerifyInput = {
  question: string
  maxResults?: number
}

export const webSearchTool: AIToolDefinition<WebSearchInput> = {
  name: "web_search",
  title: "联网搜索",
  description: "搜索互联网信息，适合热点、新闻、近期趋势、技术资料、产品信息。",
  scope: "self",
  inputSchemaSummary: 'query: string, maxResults?: number, contentType?: "snippet"|"summary", queryRewrite?: boolean',
  sensitivity: "medium",
  auditLabel: "web_search",
  whenToUse: "用户明确要求搜一下、查一下、网上有没有，或问题需要外部网页资料时使用。",
  whenNotToUse: "不要用于站内数据、个人记忆、聊天记录、我的文章、群聊、好友聊天等私有数据问题。",
  argumentHints: ["query 必填，最多 300 字", "maxResults 默认 5，最大 10", "contentType 默认 snippet"],
  returns: "联网搜索结果，包含标题、链接、摘要、正文片段和来源位置。结果可能晚于模型内置知识库截止时间，应以来源为准并在回答中展示来源。",
  execute: async (ctx) => runWebSearchTool({
    userId: ctx.userId,
    toolName: "web_search",
    query: ctx.query,
    maxResults: ctx.maxResults,
    contentType: ctx.contentType,
    queryRewrite: ctx.queryRewrite,
  }),
}

export const webVerifyCurrentInfoTool: AIToolDefinition<WebVerifyInput> = {
  name: "web_verify_current_info",
  title: "核验当前信息",
  description: "当用户询问最新、现在、今天、最近、当前、新闻、热点、价格、版本、政策、规则、发布、上线、变更等可能过时的问题时调用。",
  scope: "self",
  inputSchemaSummary: "question: string, maxResults?: number",
  sensitivity: "medium",
  auditLabel: "web_verify_current_info",
  whenToUse: "问题涉及最新、当前、新闻、热点、价格、版本、政策、规则、发布、上线、变更等时优先调用。",
  whenNotToUse: "不要用于我和你最近聊了什么、你记得我之前让你记住什么、我的文章、我的群聊、我的好友聊天等站内或记忆问题。",
  argumentHints: ["question 必填", "maxResults 默认 5，最大 10"],
  returns: "用于核验时效性问题的网页来源列表。结果可能晚于模型内置知识库截止时间，应以来源为准并在回答中展示来源。",
  execute: async (ctx) => runWebSearchTool({
    userId: ctx.userId,
    toolName: "web_verify_current_info",
    query: ctx.question,
    maxResults: ctx.maxResults,
    contentType: "snippet",
    queryRewrite: true,
  }),
}
