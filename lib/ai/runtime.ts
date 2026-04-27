import "server-only"
import { readFile } from "node:fs/promises"
import path from "node:path"
import {
  completeAIRunStep,
  completeAIToolCallLog,
  createAIAuditLog,
  createAIRunStep,
  createAIToolCallLog,
  finalizeAIRun,
  getEffectiveProviderConfig,
  getAIRunByMessageId,
  listRecentConversationHistory,
} from "@/lib/ai/service"
import { requestProviderChat, type ProviderMessage, type ProviderToolCall, type ProviderToolSpec } from "@/lib/ai/provider"
import { AI_TOOL_MAP, AI_TOOLS_REGISTRY } from "@/lib/ai/tools/registry"
import { buildAIToolContext, compactText, createAIToolActor } from "@/lib/ai/tools/context"
import { isStructuredToolResult, resolveUserReference } from "@/lib/ai/tools/helpers"
import { loadAgentPersonaContext, buildAgentPersonaPrompt } from "@/lib/ai/agent-profile-service"
import { buildMemoryContext, saveToolMemoryCandidate } from "@/lib/ai/memory/memory-service"
import { buildCapabilitySummaryText } from "@/lib/ai/capability-map"
import type {
  AIConversationHistoryEntry,
  AIProviderCapabilities,
  AIRuntimePlan,
  AIRuntimePlanStep,
  AIRuntimeResponse,
  AIRunStepType,
  AIToolExecutionRecord,
} from "@/lib/ai/types"

const MAX_AGENT_ROUNDS = 6
const MAX_TOOL_CALLS = 8

type RuntimeAttachment = {
  uploadId?: string | null
  url: string
  originalName: string
  mimeType: string
  size: number
}

type RuntimeParams = {
  userId: string
  conversationId: string
  assistantMessageId: string
  runId: string
  prompt: string
  attachments: RuntimeAttachment[]
  modelOverride?: string
  onToken?: (chunk: string) => Promise<void> | void
  onEvent?: (event: string, payload: unknown) => Promise<void> | void
}

type RuntimeState = {
  orderIndex: number
  emittedWarnings: Set<string>
}

function nextOrderIndex(state: RuntimeState) {
  state.orderIndex += 1
  return state.orderIndex
}

function compactJson(value: unknown) {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function formatToolResultForLLM(result: unknown): string {
  if (isStructuredToolResult(result)) {
    const parts: string[] = [`[结果] ${result.summary}`]
    if (result.reason) parts.push(`[原因] ${result.reason}`)
    if (result.data !== null && result.data !== undefined) {
      try {
        parts.push(JSON.stringify(result.data))
      } catch {
        parts.push(String(result.data))
      }
    }
    return parts.join("\n")
  }
  return compactJson(result)
}

function chunkText(value: string, size = 100) {
  if (!value) return []
  const chunks: string[] = []
  for (let index = 0; index < value.length; index += size) {
    chunks.push(value.slice(index, index + size))
  }
  return chunks
}

function extractTargetHint(prompt: string) {
  const directId = prompt.match(/\b[a-z0-9]{20,}\b/i)?.[0]
  const email = prompt.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0]
  const afterUser = prompt.match(/(?:用户|member|user|好友|friend)\s*[:：]?\s*([^\s，。]+)/i)?.[1]
  return directId ?? email ?? afterUser ?? null
}

function normalizePrompt(prompt: string) {
  return prompt.toLowerCase()
}

function hasArticleWords(text: string) {
  return /(文章|博客|日常|心得|笔记|blog|daily|reflection|note|post)/i.test(text)
}

function hasPermissionWords(text: string) {
  return /(权限|能不能看|可见|开放|允许|管理员|admin)/i.test(text)
}

function buildPlan(mode: AIRuntimePlan["mode"], summary: string, steps: AIRuntimePlanStep[], delegatedTargetUserId: string | null = null): AIRuntimePlan {
  return {
    mode,
    delegatedTargetUserId,
    summary,
    steps,
  }
}

async function buildHeuristicPlan(prompt: string, actorUserId: string): Promise<AIRuntimePlan> {
  const normalized = normalizePrompt(prompt)
  const targetHint = extractTargetHint(prompt)
  const resolvedTarget = targetHint ? await resolveUserReference(targetHint) : null
  const targetUserId = resolvedTarget?.id ?? null
  const isTargetOtherUser = Boolean(targetUserId && targetUserId !== actorUserId)
  const wantsAdminLookup = /(管理员|代查|后台|admin|用户日志|用户会话|用户授权)/i.test(prompt)

  if (hasPermissionWords(normalized) && /(我是不是管理员|管理员权限|admin permission)/i.test(prompt)) {
    return buildPlan("self", "将先检查当前用户的角色和管理员权限。", [
      { toolName: "get_my_permissions", reason: "问题直接询问当前用户权限。", input: null },
    ])
  }

  if (wantsAdminLookup && isTargetOtherUser) {
    if (/(登录|会话|session|ip|device|设备)/i.test(normalized)) {
      return buildPlan("admin-delegated", "将以管理员权限读取目标用户会话。", [
        { toolName: "list_admin_user_sessions", reason: "问题涉及某个用户的登录会话。", input: { targetUserId, limit: 20 } },
      ], targetUserId)
    }
    if (/(活动|日志|login|logout|activity)/i.test(normalized)) {
      return buildPlan("admin-delegated", "将以管理员权限读取目标用户活动日志。", [
        { toolName: "list_admin_user_activity_logs", reason: "问题涉及某个用户的活动日志。", input: { targetUserId, limit: 20 } },
      ], targetUserId)
    }
    if (/(授权|grant|request|申请|audit|审计|ai)/i.test(normalized)) {
      if (/(request|申请)/i.test(normalized)) {
        return buildPlan("admin-delegated", "将读取后台 AI 访问申请。", [
          { toolName: "list_admin_ai_access_requests", reason: "问题涉及 AI 访问申请。", input: { limit: 20 } },
        ], targetUserId)
      }
      if (/(audit|审计)/i.test(normalized)) {
        return buildPlan("admin-delegated", "将读取后台 AI 审计记录。", [
          { toolName: "list_admin_ai_audit_logs", reason: "问题涉及 AI 审计日志。", input: { targetUserId, limit: 20 } },
        ], targetUserId)
      }
      return buildPlan("admin-delegated", "将读取后台 AI 授权记录。", [
        { toolName: "list_admin_ai_grants", reason: "问题涉及 AI 授权状态。", input: { limit: 20 } },
      ], targetUserId)
    }
    return buildPlan("admin-delegated", "将以管理员权限读取目标用户详情。", [
      { toolName: "get_admin_user_detail", reason: "问题涉及某位用户的资料或状态。", input: { targetUserId } },
    ], targetUserId)
  }

  if (isTargetOtherUser) {
    if (hasPermissionWords(normalized)) {
      return buildPlan("visible-user", "将先检查当前用户对目标用户页面的访问权限。", [
        { toolName: "get_visible_user_permissions", reason: "问题先要判断当前用户能看到哪些模块。", input: { targetUserId } },
      ], targetUserId)
    }
    if (/(简历|resume)/i.test(normalized)) {
      return buildPlan("visible-user", "将按好友可见权限读取目标用户简历。", [
        { toolName: "get_visible_user_resume_detail", reason: "问题直接要求好友简历内容。", input: { targetUserId } },
      ], targetUserId)
    }
    if (hasArticleWords(normalized)) {
      return buildPlan("visible-user", "将先列出当前用户可见的好友文章，再按需读取全文。", [
        { toolName: "list_visible_user_posts", reason: "需要先定位当前用户可见的好友文章。", input: { targetUserId, query: prompt, limit: 10 } },
      ], targetUserId)
    }
    if (/(求职|投递|job|offer)/i.test(normalized)) {
      return buildPlan("visible-user", "将读取当前用户可见的好友求职记录。", [
        { toolName: "list_visible_user_jobs", reason: "问题涉及好友求职记录。", input: { targetUserId, query: prompt, limit: 20 } },
      ], targetUserId)
    }
    if (/(面试|interview)/i.test(normalized)) {
      return buildPlan("visible-user", "将读取当前用户可见的好友面试记录。", [
        { toolName: "list_visible_user_interviews", reason: "问题涉及好友面试记录。", input: { targetUserId, query: prompt, limit: 20 } },
      ], targetUserId)
    }
    return buildPlan("visible-user", "将读取当前用户可见的好友主页概览。", [
      { toolName: "get_visible_user_home_overview", reason: "问题涉及好友主页内容。", input: { targetUserId } },
    ], targetUserId)
  }

  // ── AI conversation history intent detection (BEFORE friend chat routing) ──
  const aiConversationPatterns = [
    /(?:我跟?你|你和?我|我们之间|我们俩|我们先前|咱们).*(?:聊|对话|消息|问过|说过|交流|沟通)/,
    /(?:和|跟)蝶灵.*(?:聊|对话|消息|问过)/,
    /(?:和|跟)(?:AI|人工智能|助手|SoulWing|soulwing).*(?:聊|对话)/,
    /我(?:之前|上次|昨天|今天|刚才|最近).*(?:问过你|和你聊|跟你聊|问你的)/,
    /你.*记.*我.*(?:问过|说过|聊过)/,
    /(?:我们|之前).*(?:聊了什么|聊过什么|聊过哪些|说过什么|谈了什么)/,
    /(?:和|跟)(?:你的|您的).*(?:对话|聊天|交流)/,
  ]

  const isAiConversationQuery = aiConversationPatterns.some((p) => p.test(prompt))

  // ── Follow-up detection: short time-range question (e.g. "那过去一天呢？") ──
  const isFollowUpWithTime = /^那.?|^那?(?:过去)?(?:最近|这|上|过去).*(?:呢|吗|啊)?$/.test(prompt.trim())
    && /(?:天|小时|周|月)/.test(prompt)
    && !/(?:好友|朋友|群里|群聊|频道)/.test(prompt)

  const steps: AIRuntimePlanStep[] = []

  if (isAiConversationQuery) {
    let mode = "topics"
    if (/(几[次回个条遍]|多少[次回个条遍]|次数|频率|统计)/.test(prompt)) {
      mode = "count"
    } else if (/(写了什么|回了什么|说[了什么]|消息|内容|原文)/.test(prompt)) {
      mode = "messages"
    } else if (/(摘要|总结|概括|重点)/.test(prompt)) {
      mode = "summary"
    }

    let timeRange = "all"
    if (/(刚才|刚刚|最近|一会儿)/.test(prompt) && !/(天|周|月|星期)/.test(prompt)) timeRange = "2h"
    if (/(最近.*小时|小时.*前|小时.*内)/.test(prompt)) {
      const m = prompt.match(/(\d+)\s*个?\s*(?:小时|h)/)
      if (m) timeRange = `${m[1]}h`
      else timeRange = "2h"
    }
    if (/(今天|过去.*一天|一天.*前|24.*小时|昨天)/.test(prompt)) timeRange = "24h"
    if (/(过去.*(?:一周|7天)|上周|七天|7天|周)/.test(prompt)) timeRange = "7d"
    if (/(过去.*(?:一个月|30天)|上月|30天|月)/.test(prompt)) timeRange = "30d"

    steps.push({
      toolName: "search_soulwing_conversations",
      reason: `用户询问与蝶灵的 AI 对话历史（mode=${mode}, timeRange=${timeRange}）。`,
      input: { mode, timeRange, limit: mode === "count" ? undefined : 10 },
    })
  } else if (isFollowUpWithTime) {
    let timeRange = "all"
    if (/(小时|h)/.test(prompt)) timeRange = "2h"
    if (/(?:一天|24|今天|昨天)/.test(prompt)) timeRange = "24h"
    if (/(?:周|7天|七天)/.test(prompt)) timeRange = "7d"
    if (/(?:月|30天)/.test(prompt)) timeRange = "30d"

    steps.push({
      toolName: "search_soulwing_conversations",
      reason: "追问时间范围，沿用 AI 对话历史数据源。",
      input: { mode: "count", timeRange, limit: undefined },
    })
  }

  if (!isAiConversationQuery && !isFollowUpWithTime) {
    if (/(搜索|查找|检索|find|search)/i.test(normalized) && /(聊天|消息|chat)/i.test(normalized)) {
      steps.push({
        toolName: "search_my_chat_messages",
        reason: "问题是在当前用户聊天记录里做搜索。",
        input: {
          query: prompt.replace(/.*?(搜索|查找|检索)/i, "").trim() || prompt,
          peerHint: targetHint ?? undefined,
          limit: 10,
        },
      })
    } else if ((/(聊天记录|会话消息|thread)/i.test(normalized) || /和谁聊|跟谁聊/.test(prompt)) && targetHint) {
      steps.push({
        toolName: "get_my_chat_thread_messages",
        reason: "问题指向某个聊天对象的消息内容。",
        input: { peerHint: targetHint, limit: 12 },
      })
    } else if (/(聊天|消息|chat)/i.test(normalized)) {
      steps.push({
        toolName: "get_my_chat_threads_overview",
        reason: "问题涉及聊天概况或聊天对象排行。",
        input: null,
      })
    }
  }

  if (/(好友|朋友|friend)/i.test(normalized)) {
    steps.push({
      toolName: /(资料|昵称|邮箱|地区|个签|profile)/i.test(normalized) && targetHint ? "get_my_friend_profile" : "list_my_friends",
      reason: "问题涉及好友资料或好友列表。",
      input: /(资料|昵称|邮箱|地区|个签|profile)/i.test(normalized) && targetHint ? { friendHint: targetHint } : { limit: 30 },
    })
  }

  if (!isAiConversationQuery && !isFollowUpWithTime && /(登录|ip|设备|session|会话|安全)/i.test(normalized)) {
    steps.push({
      toolName: "get_my_sessions_overview",
      reason: "问题涉及当前用户会话和登录设备。",
      input: null,
    })
  }

  if (!isAiConversationQuery && !isFollowUpWithTime && /(活动|日志|记录|行为)/i.test(normalized) && !/(聊天|消息)/i.test(normalized)) {
    steps.push({
      toolName: "get_my_activity_log",
      reason: "问题涉及当前用户活动日志。",
      input: null,
    })
  }

  if (/(设置|language|偏好)/i.test(normalized)) {
    steps.push({
      toolName: "get_my_settings",
      reason: "问题涉及站点设置。",
      input: null,
    })
  }

  if (/(主页|首页|模块)/i.test(normalized)) {
    steps.push({
      toolName: "get_my_home_overview",
      reason: "问题涉及主页概况和模块内容。",
      input: null,
    })
  }

  if (/(简历|resume|pdf)/i.test(normalized)) {
    steps.push({
      toolName: /(全文|完整|润色|修改|总结)/i.test(normalized) ? "get_my_resume_detail" : "get_my_resume_overview",
      reason: "问题涉及当前用户简历。",
      input: null,
    })
  }

  if (/(求职|投递|job|offer)/i.test(normalized)) {
    steps.push({
      toolName: /(详情|明细|哪条|某个|company|公司)/i.test(normalized) ? "list_my_jobs" : "get_my_jobs_overview",
      reason: "问题涉及当前用户求职记录。",
      input: /(详情|明细|哪条|某个|company|公司)/i.test(normalized) ? { query: prompt, limit: 10 } : null,
    })
  }

  if (/(面试|interview)/i.test(normalized)) {
    steps.push({
      toolName: /(详情|题目|反馈|哪次|某次)/i.test(normalized) ? "list_my_interviews" : "get_my_interviews_overview",
      reason: "问题涉及当前用户面试记录。",
      input: /(详情|题目|反馈|哪次|某次)/i.test(normalized) ? { query: prompt, limit: 10 } : null,
    })
  }

  if (hasArticleWords(normalized)) {
    steps.push({
      toolName: /(搜索|查找|找出|哪篇)/i.test(normalized) ? "search_my_posts" : /全文|完整|正文|内容/.test(normalized) ? "list_my_posts" : "get_my_posts_overview",
      reason: "问题涉及当前用户文章内容。",
      input: /(搜索|查找|找出|哪篇|全文|完整|正文|内容)/i.test(normalized) ? { query: prompt, limit: 10 } : null,
    })
  }

  // Content management intent: create / edit / move / folder
  const wantsCreateArticle = /(创建|新建|写一篇|写个|写一篇|撰写|发布).*(文章|博客|日常|心得|笔记|blog|daily|note|reflection|post)/i.test(prompt)
  const wantsEditArticle = /(修改|编辑|更新|改).*(文章|博客|日常|心得|笔记|标题|正文|内容)/i.test(prompt)
  const wantsListForEdit = /(列出|查看|找).*(我的|自己).*(文章|博客|日常|心得|笔记).*(编辑|修改|管理)/i.test(prompt)
  const wantsCreateFolder = /(创建|新建|加个|建个).*(文件夹|分类|目录)/i.test(prompt)
  const wantsListFolder = /(列出|查看).*(文件夹|分类|目录)/i.test(prompt)
  const wantsMoveArticle = /(移动|移|搬).*(文章|博客|日常|心得|笔记).*(到|至|文件夹|模块)/i.test(prompt)

  if (wantsCreateFolder || /^只?(创建|新建|建|加).*(文件夹|分类)/i.test(prompt)) {
    steps.push({
      toolName: "create_content_folder",
      reason: "用户要求创建内容文件夹。",
      input: null,
    })
  }

  if (wantsListFolder || wantsListForEdit) {
    steps.push({
      toolName: "list_content_folders",
      reason: "用户要求列出文件夹或查找可编辑文章。",
      input: null,
    })
  }

  if (wantsCreateArticle) {
    steps.push({
      toolName: "create_markdown_article",
      reason: "用户要求创建新文章。",
      input: null,
    })
  }

  if (wantsEditArticle) {
    steps.push({
      toolName: /^(列出|找|查看|搜索)/i.test(prompt) ? "list_markdown_articles" : "get_markdown_article_detail",
      reason: "用户要求编辑文章，先读取当前内容。",
      input: null,
    })
  }

  if (wantsMoveArticle) {
    steps.push({
      toolName: "move_article_to_folder",
      reason: "用户要求移动文章。",
      input: null,
    })
  }

  if (steps.length === 0) {
    steps.push({
      toolName: "get_my_profile",
      reason: "未命中特定领域，先回到用户基础资料。",
      input: null,
    })
  }

  const deduped = steps.filter((step, index, list) => list.findIndex((item) => item.toolName === step.toolName) === index)
  return buildPlan("self", "将按问题内容选择当前用户可访问的数据工具。", deduped)
}

function buildReasoningSummary(summaryParts: string[]) {
  return compactText(summaryParts.filter(Boolean).join(" "), 180)
}

function buildToolTraceSummary(executions: AIToolExecutionRecord[]) {
  if (executions.length === 0) return "本次未调用工具。"
  return executions
    .map((item) => {
      const summary = isStructuredToolResult(item.result)
        ? item.result.summary
        : item.status === "completed"
          ? "已完成"
          : `失败 - ${item.error ?? "未知错误"}`
      return `${item.title}：${summary}`
    })
    .join("\n")
}

function buildFallbackAnswer(prompt: string, executions: AIToolExecutionRecord[], warning?: string) {
  const sections = [warning ? `> ${warning}` : "", `问题：${prompt}`].filter(Boolean)

  if (executions.length === 0) {
    sections.push("", "当前没有可用的工具结果，我无法安全地访问额外站内数据。")
    return sections.join("\n")
  }

  sections.push("")
  for (const item of executions) {
    sections.push(`## ${item.title}`)
    if (item.status === "failed") {
      sections.push(`执行失败：${item.error ?? "未知错误"}`)
    } else if (isStructuredToolResult(item.result)) {
      sections.push(item.result.summary)
      if (item.result.reason) sections.push(`原因：${item.result.reason}`)
      sections.push("```json")
      sections.push(compactJson(item.result.data))
      sections.push("```")
    } else {
      sections.push("```json")
      sections.push(compactJson(item.result))
      sections.push("```")
    }
    sections.push("")
  }

  return sections.join("\n").trim()
}

function looksLikeSiteDataQuestion(prompt: string) {
  return /(登录|会话|设备|ip|好友|聊天|消息|求职|投递|面试|简历|上传|文章|博客|日常|心得|笔记|用户|管理员|代查|站内|资料|主页)/i.test(prompt)
}

function buildRuntimeSystemPrompt(params: {
  capabilities: AIProviderCapabilities
  canUseTools: boolean
  canUseVision: boolean
  personaPrompt?: string
}) {
  const platformRules = [
    "你是蝶灵（SoulWing），当前用户的专属 AI 助手。",
    params.canUseTools
      ? `你拥有工具调用能力（每次对话最多 ${MAX_TOOL_CALLS} 次工具调用、${MAX_AGENT_ROUNDS} 轮推理）。凡是涉及站内私有数据的问题，必须先调用合适工具获取数据，再作答。不要用"我无法获取"或"我不知道"搪塞可以通过工具解决的问题。`
      : "当前 provider 不支持原生工具调用。你不能假装读取了站内私有数据；如确需私有数据，应明确说明能力受限。",
    "通用知识/逻辑问题直接回答，无需调用工具。判断依据：问题是否需要当前用户的站内私有数据？需要则调工具，不需要则直接作答。",
    "数据源区分：当用户说【我跟你】【我和你】【我们之前】【你记得吗】【我问过你什么】【和蝶灵聊了什么】时，默认指用户与蝶灵（SoulWing）的 AI 对话历史。不要将其理解为好友聊天、群聊或系统操作日志。",
    "AI 对话历史查询：遇到【我和你聊了几次/聊了什么/聊了什么主题/之前问过你什么】等问题时，优先调用 search_soulwing_conversations。如果该工具查不到结果，再说明没有查到历史记录。决不允许在未调用工具前说【我只能看到当前对话】或【我无法获取过去的聊天记录】。",
    "如果用户问题有歧义（可能指 AI 对话，也可能指好友聊天），应简要说明你理解的口径（【我理解你是在问我们之间的 AI 对话历史】），然后调用对应工具。如果追问中省略主语（如【那过去一天呢】），沿用上一个问题的数据源——如果上一个问题是 AI 对话，继续使用 search_soulwing_conversations。",
    "数据源优先级：当问题可能属于多个数据源时，按以下优先级选择：1. AI 对话历史（search_soulwing_conversations / search_user_memory 中的 event）；2. 长期记忆（search_user_memory 中的 fact）；3. 好友聊天（search_my_chat_messages 等）；4. 群聊（get_channel_messages）；5. 系统操作日志（get_my_activity_log）。选择最贴合用户语义的那一个，不要同时调用多个不相关的数据源工具。",
    "当需要站内数据时，优先遵循：先判断权限，再看概览，再取列表，再读详情或全文。",
    params.canUseVision
      ? "当前请求支持视觉输入；如果用户上传了图片，先描述图像内容，再结合问题作答。"
      : "当前请求不支持视觉输入，不要假装看到了图片内容。",
    params.capabilities.reasoningStream
      ? "如生成推理过程，请保持简洁，不要输出敏感隐藏推理。"
      : "",
    "如果好友内容或后台数据没有权限，明确说明无权访问，不要继续猜测。",
    "你可以帮助用户管理其自己的 Markdown 内容（博客/日常/心得/笔记）：创建文章、修改文章、创建文件夹、移动文章。只能操作用户自己的内容，不能跨用户操作。",
    "你可以管理用户的长期记忆：当用户明确说'记住……'时保存记忆；当用户说'忘掉……'时删除记忆（需要确认）；需要参考历史偏好或决策时主动搜索记忆。不要自动保存所有聊天内容为记忆，不要保存敏感信息或文章全文。",
    "你还可以更新自己的长期人格配置 update_agent_profile：当用户说'以后你回答风格要……''以后我叫你……''我正在做的长期项目是……''以后必须遵守……'时，更新对应分区（identity/soul/user/rules）。append 默认可用，rewrite 和 rules 修改需要确认。不要因为一句情绪化吐槽就自动改人格。",
    "跨模块移动文章前必须先得到用户明确确认（confirmedByUser=true），不得直接执行。不允许删除文章或文件夹。修改文章时不允许清空正文。",
    "高风险写入操作前应简要告知用户将要执行的操作，让用户有机会纠正。",
    "回答必须可信、简洁、结构化，且不得虚构工具结果。",
  ].filter(Boolean)

  const parts: string[] = [platformRules.join(" ")]

  if (params.canUseTools) {
    parts.push(buildCapabilitySummaryText())
  }

  if (params.personaPrompt) {
    parts.push(params.personaPrompt)
  }

  return parts.join("\n\n")
}

function buildProviderTools(): ProviderToolSpec[] {
  return AI_TOOLS_REGISTRY
    .filter((tool) => !tool.deprecated)
    .map((tool) => ({
      type: "function",
      function: {
        name: tool.name,
        description: [
          tool.description,
          tool.whenToUse ? `Use when: ${tool.whenToUse}` : "",
          tool.whenNotToUse ? `Avoid when: ${tool.whenNotToUse}` : "",
          tool.argumentHints?.length ? `Arguments: ${tool.argumentHints.join("; ")}` : "",
          tool.returns ? `Returns: ${tool.returns}` : "",
        ].filter(Boolean).join(" "),
        parameters: tool.parameterSchema ?? toolParametersSchema(tool.name),
      },
    }))
}

function toolParametersSchema(toolName: string) {
  switch (toolName) {
    case "search_my_chat_messages":
      return {
        type: "object",
        properties: {
          query: { type: "string", description: "Keyword query for chat message search." },
          peerHint: { type: "string", description: "Optional peer identifier, email, or display name." },
          limit: { type: "integer", minimum: 1, maximum: 20 },
        },
        additionalProperties: false,
      }
    case "get_my_chat_thread_messages":
      return {
        type: "object",
        properties: {
          peerHint: { type: "string", description: "Peer identifier, email, or display name." },
          limit: { type: "integer", minimum: 1, maximum: 30 },
        },
        additionalProperties: false,
      }
    case "get_my_friend_profile":
      return {
        type: "object",
        properties: {
          friendId: { type: "string", description: "Friend user id." },
          friendHint: { type: "string", description: "Friend nickname, email, or fuzzy hint." },
        },
        additionalProperties: false,
      }
    case "list_my_posts":
    case "list_visible_user_posts":
      return {
        type: "object",
        properties: {
          targetUserId: { type: "string", description: "Target user id for visible-user tools." },
          postType: { type: "string", enum: ["blog", "daily", "reflections", "notes"] },
          query: { type: "string", description: "Optional keyword filter." },
          limit: { type: "integer", minimum: 1, maximum: 50 },
        },
        additionalProperties: false,
      }
    case "search_my_posts":
      return {
        type: "object",
        properties: {
          query: { type: "string", description: "Keyword query for post search." },
          postType: { type: "string", enum: ["blog", "daily", "reflections", "notes"] },
          limit: { type: "integer", minimum: 1, maximum: 30 },
        },
        required: ["query"],
        additionalProperties: false,
      }
    case "get_my_post_detail":
    case "get_my_post_content":
    case "get_visible_user_post_content":
      return {
        type: "object",
        properties: {
          targetUserId: { type: "string", description: "Target user id for visible-user tools." },
          postId: { type: "string", description: "Post id." },
          slug: { type: "string", description: "Post slug." },
          postType: { type: "string", enum: ["blog", "daily", "reflections", "notes"] },
        },
        additionalProperties: false,
      }
    case "list_my_jobs":
    case "list_visible_user_jobs":
      return {
        type: "object",
        properties: {
          targetUserId: { type: "string", description: "Target user id for visible-user tools." },
          status: { type: "string" },
          query: { type: "string" },
          limit: { type: "integer", minimum: 1, maximum: 50 },
        },
        additionalProperties: false,
      }
    case "get_my_job_detail":
    case "get_visible_user_job_detail":
      return {
        type: "object",
        properties: {
          targetUserId: { type: "string", description: "Target user id for visible-user tools." },
          jobId: { type: "string", description: "Job record id." },
        },
        required: ["jobId"],
        additionalProperties: false,
      }
    case "list_my_interviews":
    case "list_visible_user_interviews":
      return {
        type: "object",
        properties: {
          targetUserId: { type: "string", description: "Target user id for visible-user tools." },
          result: { type: "string" },
          query: { type: "string" },
          limit: { type: "integer", minimum: 1, maximum: 50 },
        },
        additionalProperties: false,
      }
    case "get_my_interview_detail":
    case "get_visible_user_interview_detail":
      return {
        type: "object",
        properties: {
          targetUserId: { type: "string", description: "Target user id for visible-user tools." },
          interviewId: { type: "string", description: "Interview record id." },
        },
        required: ["interviewId"],
        additionalProperties: false,
      }
    case "get_visible_user_permissions":
    case "get_visible_user_home_overview":
    case "get_visible_user_resume_detail":
    case "get_visible_user_page_overview":
    case "get_admin_user_profile_overview":
    case "get_admin_user_detail":
      return {
        type: "object",
        properties: {
          targetUserId: { type: "string", description: "Target user id." },
        },
        required: ["targetUserId"],
        additionalProperties: false,
      }
    case "list_admin_user_activity_logs":
    case "list_admin_user_sessions":
      return {
        type: "object",
        properties: {
          targetUserId: { type: "string", description: "Target user id." },
          limit: { type: "integer", minimum: 1, maximum: 50 },
          cursor: { type: "string" },
        },
        required: ["targetUserId"],
        additionalProperties: false,
      }
    case "list_admin_ai_access_requests":
    case "list_admin_ai_grants":
    case "list_admin_users":
      return {
        type: "object",
        properties: {
          limit: { type: "integer", minimum: 1, maximum: 50 },
          cursor: { type: "string" },
          query: { type: "string" },
          status: { type: "string" },
        },
        additionalProperties: false,
      }
    case "list_admin_ai_audit_logs":
      return {
        type: "object",
        properties: {
          targetUserId: { type: "string", description: "Optional target user id filter." },
          limit: { type: "integer", minimum: 1, maximum: 50 },
          cursor: { type: "string" },
        },
        additionalProperties: false,
      }
    case "create_markdown_article":
      return {
        type: "object",
        properties: {
          module: { type: "string", enum: ["blog", "daily", "reflections", "notes"], description: "Content module." },
          title: { type: "string", description: "Article title. Required, non-empty." },
          content: { type: "string", description: "Markdown body content." },
          summary: { type: "string", description: "Short summary." },
          tags: { type: "array", items: { type: "string" }, description: "Tags array." },
          folderId: { type: "string", description: "Optional folder id. Omit or pass null for root." },
          visibility: { type: "string", enum: ["private", "friends"], description: "Visibility, defaults to private." },
          date: { type: "string", description: "ISO date string." },
        },
        required: ["module", "title"],
        additionalProperties: false,
      }
    case "update_markdown_article":
      return {
        type: "object",
        properties: {
          module: { type: "string", enum: ["blog", "daily", "reflections", "notes"], description: "Content module the article belongs to." },
          articleId: { type: "string", description: "Article id to update." },
          title: { type: "string", description: "New title." },
          content: { type: "string", description: "New body content. Must not be empty string." },
          summary: { type: "string", description: "New summary." },
          tags: { type: "array", items: { type: "string" }, description: "New tags array." },
          folderId: { type: "string", description: "Move to folder id. Pass null to move to root. Omit to leave unchanged." },
          visibility: { type: "string", enum: ["private", "friends"], description: "New visibility." },
          date: { type: "string", description: "New ISO date string." },
        },
        required: ["module", "articleId"],
        additionalProperties: false,
      }
    case "get_markdown_article_detail":
      return {
        type: "object",
        properties: {
          module: { type: "string", enum: ["blog", "daily", "reflections", "notes"], description: "Content module." },
          articleId: { type: "string", description: "Article id." },
          slug: { type: "string", description: "Article slug." },
        },
        required: ["module"],
        additionalProperties: false,
      }
    case "list_markdown_articles":
      return {
        type: "object",
        properties: {
          module: { type: "string", enum: ["blog", "daily", "reflections", "notes"], description: "Content module." },
          folderId: { type: "string", description: "Optional folder id filter. Omit to list all, null for root." },
          keyword: { type: "string", description: "Optional keyword search." },
          limit: { type: "integer", minimum: 1, maximum: 30 },
        },
        required: ["module"],
        additionalProperties: false,
      }
    case "create_content_folder":
      return {
        type: "object",
        properties: {
          module: { type: "string", enum: ["blog", "daily", "reflections", "notes"], description: "Content module." },
          name: { type: "string", description: "Folder name. Required, non-empty." },
          description: { type: "string", description: "Optional folder description." },
        },
        required: ["module", "name"],
        additionalProperties: false,
      }
    case "list_content_folders":
      return {
        type: "object",
        properties: {
          module: { type: "string", enum: ["blog", "daily", "reflections", "notes"], description: "Content module." },
        },
        required: ["module"],
        additionalProperties: false,
      }
    case "move_article_to_folder":
      return {
        type: "object",
        properties: {
          sourceModule: { type: "string", enum: ["blog", "daily", "reflections", "notes"], description: "The module the article currently belongs to." },
          articleId: { type: "string", description: "Article id to move." },
          targetModule: { type: "string", enum: ["blog", "daily", "reflections", "notes"], description: "Target module. Defaults to sourceModule for same-module moves." },
          targetFolderId: { type: "string", description: "Target folder id. Pass null to move to root. Omit to keep current folder." },
          confirmedByUser: { type: "boolean", description: "Required to be true for cross-module moves (sourceModule !== targetModule)." },
        },
        required: ["sourceModule", "articleId"],
        additionalProperties: false,
      }
    case "save_user_memory":
      return {
        type: "object",
        properties: {
          category: { type: "string", enum: ["preference", "project", "decision", "workflow", "bugfix", "content_operation", "other"], description: "Memory category." },
          title: { type: "string", description: "Short title for the memory." },
          content: { type: "string", description: "Memory content. Do NOT store full article bodies or full conversation transcripts." },
          tags: { type: "array", items: { type: "string" }, description: "Tags array." },
          importance: { type: "string", enum: ["low", "medium", "high"], description: "Importance, defaults to medium." },
          expiresAt: { type: "string", description: "Optional ISO date for expiration." },
        },
        required: ["category", "title", "content"],
        additionalProperties: false,
      }
    case "search_user_memory":
      return {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query." },
          category: { type: "string", enum: ["preference", "project", "decision", "workflow", "bugfix", "content_operation", "other"], description: "Optional category filter." },
          limit: { type: "integer", minimum: 1, maximum: 20 },
        },
        required: ["query"],
        additionalProperties: false,
      }
    case "list_user_memories":
      return {
        type: "object",
        properties: {
          category: { type: "string", enum: ["preference", "project", "decision", "workflow", "bugfix", "content_operation", "other"], description: "Optional category filter." },
          limit: { type: "integer", minimum: 1, maximum: 50 },
        },
        additionalProperties: false,
      }
    case "forget_user_memory":
      return {
        type: "object",
        properties: {
          memoryId: { type: "string", description: "MemoryFact id to delete." },
          confirmedByUser: { type: "boolean", description: "Must be true to execute deletion. If false or absent, only returns confirmation prompt." },
        },
        required: ["memoryId"],
        additionalProperties: false,
      }
    case "update_agent_profile":
      return {
        type: "object",
        properties: {
          section: { type: "string", enum: ["identity", "soul", "user", "rules"], description: "Which AgentProfile section to update." },
          operation: { type: "string", enum: ["append", "replace_section", "rewrite"], description: "How to apply the content. Default: append. replace_section/rewrite need confirmation." },
          content: { type: "string", description: "The new content to write or append. Must be concise and structured. Do NOT paste full conversation transcripts." },
          reason: { type: "string", description: "Why this update is being made — for audit purposes." },
          confirmedByUser: { type: "boolean", description: "Required true for high-impact changes (rules modifications, rewrites)." },
        },
        required: ["section", "content"],
        additionalProperties: false,
      }
    case "list_my_capabilities":
      return {
        type: "object",
        properties: {
          categoryId: { type: "string", description: "Optional category id to filter. Omit to list all categories." },
        },
        additionalProperties: false,
      }
    case "search_my_capabilities":
      return {
        type: "object",
        properties: {
          query: { type: "string", description: "Keyword to search for in tool names, titles, descriptions, and trigger phrases." },
        },
        required: ["query"],
        additionalProperties: false,
      }
    case "propose_save_user_context":
      return {
        type: "object",
        properties: {
          text: { type: "string", description: "Text to propose saving to the USER section." },
          section: { type: "string", enum: ["user", "identity"], description: "Section to save, defaults to user." },
        },
        required: ["text"],
        additionalProperties: false,
      }
    case "get_auto_reply_settings":
      return {
        type: "object",
        properties: {},
        additionalProperties: false,
      }
    case "update_auto_reply_settings":
      return {
        type: "object",
        properties: {
          settingId: { type: "string", description: "Setting id." },
          enabled: { type: "boolean", description: "Enable or disable." },
          replyMode: { type: "string", enum: ["away_notice", "template", "hybrid", "semantic"] },
          templateText: { type: "string" },
          customInstruction: { type: "string" },
          discloseAsAutoReply: { type: "boolean" },
          allowGroupReply: { type: "boolean" },
          cooldownMinutes: { type: "integer", minimum: 5, maximum: 480 },
          maxRepliesPerDay: { type: "integer", minimum: 1, maximum: 100 },
          confirmedByUser: { type: "boolean", description: "Required when enabling or switching to semantic mode." },
        },
        additionalProperties: false,
      }
    case "list_my_channels":
      return {
        type: "object",
        properties: {},
        additionalProperties: false,
      }
    case "get_channel_messages":
      return {
        type: "object",
        properties: {
          channelId: { type: "string", description: "Channel id." },
          limit: { type: "integer", minimum: 1, maximum: 30 },
        },
        required: ["channelId"],
        additionalProperties: false,
      }
    case "send_draft_chat_message":
      return {
        type: "object",
        properties: {
          text: { type: "string", description: "Draft message text." },
          kind: { type: "string", enum: ["direct", "channel"], description: "Chat kind." },
          peerHint: { type: "string", description: "Friend identifier for direct chat." },
          channelId: { type: "string", description: "Channel id for group chat." },
        },
        required: ["text"],
        additionalProperties: false,
      }
    case "summarize_chat_thread":
      return {
        type: "object",
        properties: {
          kind: { type: "string", enum: ["direct", "channel"], description: "Chat kind." },
          peerHint: { type: "string", description: "Friend identifier for direct chat." },
          channelId: { type: "string", description: "Channel id for group chat." },
          limit: { type: "integer", minimum: 10, maximum: 100 },
        },
        additionalProperties: false,
      }
    case "delete_my_memory_fact_batch":
      return {
        type: "object",
        properties: {
          tag: { type: "string", description: "Tag to filter for batch deletion." },
          category: { type: "string", enum: ["preference", "project", "decision", "workflow", "bugfix", "content_operation", "other"] },
          confirmedByUser: { type: "boolean", description: "Must be true to execute." },
        },
        additionalProperties: false,
      }
    case "search_soulwing_conversations":
      return {
        type: "object",
        properties: {
          mode: { type: "string", enum: ["count", "topics", "summary", "messages"], description: "Query mode: count=statistics, topics=conversation topics, summary=conversation summaries, messages=message content previews." },
          timeRange: { type: "string", enum: ["1h", "2h", "6h", "24h", "7d", "30d", "all"], description: "Preset time range. Mutually exclusive with since/until." },
          since: { type: "string", description: "Custom start ISO datetime. Overrides timeRange start." },
          until: { type: "string", description: "Custom end ISO datetime. Defaults to now." },
          query: { type: "string", description: "Optional keyword filter for topics/summary/messages modes." },
          limit: { type: "integer", minimum: 1, maximum: 50, description: "Max items to return. count mode ignores this." },
        },
        additionalProperties: false,
      }
    case "set_module_visibility":
      return {
        type: "object",
        properties: {
          module: { type: "string", enum: ["home", "resume", "blog", "daily", "reflections", "notes", "jobs", "interviews"] },
          visibility: { type: "string", enum: ["private", "friends"] },
          confirmedByUser: { type: "boolean", description: "Required when changing from private to friends." },
        },
        required: ["module", "visibility"],
        additionalProperties: false,
      }
    default:
      return {
        type: "object",
        properties: {},
        additionalProperties: false,
      }
  }
}

function normalizeToolArguments(toolCall: ProviderToolCall, plan: AIRuntimePlan, actorUserId: string) {
  const tool = AI_TOOL_MAP.get(toolCall.name)
  if (!tool) return null
  const input = { ...(toolCall.arguments ?? {}) } as Record<string, unknown>

  if (tool.scope === "self") {
    input.targetUserId = actorUserId
  }

  if (tool.scope !== "self" && !input.targetUserId && plan.delegatedTargetUserId) {
    input.targetUserId = plan.delegatedTargetUserId
  }

  return input
}

function buildHistoryMessages(history: AIConversationHistoryEntry[]): ProviderMessage[] {
  return history.map((item) => ({
    role: item.role,
    content: item.content,
  }))
}

async function toProviderImageUrl(attachment: RuntimeAttachment) {
  if (attachment.url.startsWith("data:")) return attachment.url

  if (attachment.url.startsWith("/")) {
    const normalizedPath = attachment.url.replace(/^\/+/, "").split("/").join(path.sep)
    const filePath = path.join(process.cwd(), "public", normalizedPath)
    const fileBuffer = await readFile(filePath)
    return `data:${attachment.mimeType};base64,${fileBuffer.toString("base64")}`
  }

  return attachment.url
}

async function buildUserMessage(prompt: string, attachments: RuntimeAttachment[], canUseVision: boolean): Promise<ProviderMessage> {
  if (!attachments.length || !canUseVision) {
    return { role: "user", content: prompt }
  }

  const imageParts = await Promise.all(
    attachments
      .filter((attachment) => attachment.mimeType.startsWith("image/"))
      .map(async (attachment) => ({
        type: "image_url" as const,
        image_url: { url: await toProviderImageUrl(attachment) },
      })),
  )

  return {
    role: "user",
    content: [
      { type: "text", text: prompt },
      ...imageParts,
    ],
  }
}

function isVisionRelatedProviderError(error: unknown) {
  if (!(error instanceof Error)) return false
  const message = error.message.toLowerCase()
  return ["image", "vision", "multimodal", "modalities", "unsupported content type", "does not support image", "image_url", "invalid image"]
    .some((token) => message.includes(token))
}

async function emit(params: RuntimeParams, event: string, payload: unknown) {
  if (params.onEvent) await params.onEvent(event, payload)
}

async function createStep(params: RuntimeParams, state: RuntimeState, type: AIRunStepType, title: string, summary: string, inputPreview?: unknown) {
  return createAIRunStep({
    runId: params.runId,
    messageId: params.assistantMessageId,
    userId: params.userId,
    type,
    title,
    summary,
    inputPreview,
    orderIndex: nextOrderIndex(state),
  })
}

async function emitCapabilityWarning(params: RuntimeParams, state: RuntimeState, code: string, summary: string, capabilities: AIProviderCapabilities) {
  if (state.emittedWarnings.has(code)) return
  state.emittedWarnings.add(code)
  const step = await createStep(params, state, "warning", "能力降级", summary, { code })
  await completeAIRunStep(step.id, {
    status: "completed",
    summary,
    outputPreview: { warning: summary, providerMetadata: { capabilities } },
  })
  await emit(params, "capability_warning", {
    stepId: step.id,
    title: step.title,
    status: "completed",
    summary,
    outputPreview: { warning: summary, providerMetadata: { capabilities } },
  })
}

async function executeToolCall(
  params: RuntimeParams,
  state: RuntimeState,
  plan: AIRuntimePlan,
  toolCall: ProviderToolCall,
  actor?: Awaited<ReturnType<typeof createAIToolActor>>,
) {
  const resolvedActor = actor ?? await createAIToolActor(params.userId)
  const toolName = toolCall.name?.trim()
  const tool = toolName ? AI_TOOL_MAP.get(toolName) : undefined
  if (!tool) {
    const error = toolName
      ? `Unknown tool requested: ${toolName}`
      : `工具名解析失败 — name 字段为空。原始 tool_call: ${JSON.stringify({ id: toolCall.id, argumentsText: toolCall.argumentsText?.slice(0, 200) })}`
    const displayTitle = toolName ? `调用 ${toolName}` : "工具调用（名称缺失）"
    const step = await createStep(params, state, "tool_call", displayTitle, error, { arguments: toolCall.arguments })
    await completeAIRunStep(step.id, {
      status: "failed",
      summary: error,
      outputPreview: { error },
      errorMessage: error,
    })
    await emit(params, "tool_call_failed", {
      stepId: step.id,
      title: step.title,
      status: "failed",
      summary: error,
      errorMessage: error,
    })
    return {
      name: toolCall.name,
      title: toolCall.name,
      description: "Unknown tool",
      input: toolCall.arguments,
      result: { error },
      status: "failed",
      error,
      scope: "self",
      sensitivity: "low",
      auditLabel: "unknown_tool",
    } satisfies AIToolExecutionRecord
  }

  const normalizedInput = normalizeToolArguments(toolCall, plan, params.userId) ?? {}
  const step = await createStep(params, state, "tool_call", tool.title, "正在执行工具。", {
    toolName: tool.name,
    arguments: normalizedInput,
  })
  await emit(params, "tool_call_started", {
    stepId: step.id,
    title: step.title,
    status: "running",
    summary: "正在执行工具。",
    inputPreview: { toolName: tool.name, arguments: normalizedInput },
  })

  const context = buildAIToolContext({
    actor: resolvedActor,
    targetUserId: (normalizedInput as { targetUserId?: string }).targetUserId as string | undefined,
    scope: tool.scope,
  })

  const log = await createAIToolCallLog({
    conversationId: params.conversationId,
    messageId: params.assistantMessageId,
    userId: params.userId,
    toolName: tool.name,
    toolInputJson: normalizedInput,
  })

  try {
    const result = await (tool.execute as (input: Record<string, unknown>) => Promise<unknown>)({
      ...context,
      ...(normalizedInput ?? {}),
    })
    const resultSummary = isStructuredToolResult(result) ? result.summary : "工具执行完成。"
    await completeAIToolCallLog(log.id, result, "completed")

    // Persist tool memory candidate if present (e.g. from Markdown content tools)
    if (isStructuredToolResult(result) && result.data && typeof result.data === "object" && !Array.isArray(result.data)) {
      const candidate = (result.data as Record<string, unknown>).memoryCandidate
      if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) {
        void saveToolMemoryCandidate(params.userId, candidate as {
          action: string; module?: string | null; title?: string | null
          articleId?: string | null; folderId?: string | null; folderName?: string | null
          sourceModule?: string | null; targetModule?: string | null
          slugChanged?: boolean | null; changedFields?: string[]
        }, log.id).catch(() => { /* tool memory candidate save failure must not affect execution */ })
      }
    }

    await createAIAuditLog(resolvedActor.userId, context.targetUserId, "ai_tool_executed", tool.auditLabel, {
      runId: params.runId,
      stepId: step.id,
      toolName: tool.name,
      scope: tool.scope,
      delegatedTargetUserId: plan.delegatedTargetUserId ?? null,
    })
    await completeAIRunStep(step.id, {
      status: "completed",
      summary: resultSummary,
      outputPreview: {
        result,
        providerMetadata: {
          scope: tool.scope,
          sensitivity: tool.sensitivity,
        },
      },
    })
    await emit(params, "tool_call_completed", {
      stepId: step.id,
      title: step.title,
      status: "completed",
      summary: resultSummary,
      inputPreview: { toolName: tool.name, arguments: normalizedInput },
      outputPreview: {
        result,
        providerMetadata: {
          scope: tool.scope,
          sensitivity: tool.sensitivity,
        },
      },
    })
    return {
      name: tool.name,
      title: tool.title,
      description: tool.description,
      input: normalizedInput,
      result,
      status: "completed",
      scope: tool.scope,
      sensitivity: tool.sensitivity,
      auditLabel: tool.auditLabel,
    } satisfies AIToolExecutionRecord
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown tool error"
    const failure = { error: message }
    await completeAIToolCallLog(log.id, failure, "failed")
    await completeAIRunStep(step.id, {
      status: "failed",
      summary: "工具执行失败。",
      outputPreview: { error: message },
      errorMessage: message,
    })
    await emit(params, "tool_call_failed", {
      stepId: step.id,
      title: step.title,
      status: "failed",
      summary: "工具执行失败。",
      errorMessage: message,
      inputPreview: { toolName: tool.name, arguments: normalizedInput },
    })
    return {
      name: tool.name,
      title: tool.title,
      description: tool.description,
      input: normalizedInput,
      result: failure,
      status: "failed",
      error: message,
      scope: tool.scope,
      sensitivity: tool.sensitivity,
      auditLabel: tool.auditLabel,
    } satisfies AIToolExecutionRecord
  }
}

async function runHeuristicFallback(params: RuntimeParams, state: RuntimeState, warning: string) {
  const plan = await buildHeuristicPlan(params.prompt, params.userId)
  const reasoningStep = await createStep(params, state, "reasoning", "思考", warning, {
    mode: "heuristic-fallback",
    plan,
  })
  await emit(params, "reasoning_started", {
    stepId: reasoningStep.id,
    type: "reasoning",
    title: reasoningStep.title,
    status: "running",
    summary: warning,
  })
  await emit(params, "reasoning_delta", {
    stepId: reasoningStep.id,
    delta: `${warning}\n\n${plan.summary}`,
  })
  await completeAIRunStep(reasoningStep.id, {
    status: "completed",
    summary: plan.summary,
    outputPreview: { plan, providerMetadata: { fallback: "heuristic" } },
  })
  await emit(params, "reasoning_completed", {
    stepId: reasoningStep.id,
    type: "reasoning",
    title: reasoningStep.title,
    status: "completed",
    summary: plan.summary,
    outputPreview: { plan, providerMetadata: { fallback: "heuristic" } },
  })

  const executions: AIToolExecutionRecord[] = []
  const actor = await createAIToolActor(params.userId)
  for (const step of plan.steps.slice(0, MAX_TOOL_CALLS)) {
    const toolCall: ProviderToolCall = {
      id: `heuristic-${step.toolName}`,
      name: step.toolName,
      argumentsText: JSON.stringify(step.input ?? {}),
      arguments: step.input ?? {},
    }
    executions.push(await executeToolCall(params, state, plan, toolCall, actor))
  }

  return { plan, executions }
}

function shouldUseHeuristicFallback(prompt: string, capabilities: AIProviderCapabilities) {
  return !capabilities.toolCalling && looksLikeSiteDataQuestion(prompt)
}

export async function runAIRuntime(params: RuntimeParams): Promise<AIRuntimeResponse> {
  const state: RuntimeState = {
    orderIndex: 0,
    emittedWarnings: new Set<string>(),
  }

  await emit(params, "run_started", { runId: params.runId, conversationId: params.conversationId })

  const history = await listRecentConversationHistory(params.userId, params.conversationId, 10)
  const provider = await getEffectiveProviderConfig(params.userId, params.modelOverride)

  // Load per-user Agent Persona (蝶灵 SoulWing)
  let personaPrompt = ""
  try {
    const persona = await loadAgentPersonaContext(params.userId)
    personaPrompt = buildAgentPersonaPrompt(persona)
  } catch {
    // Fallback: use minimal identity if persona loading fails
    personaPrompt = buildAgentPersonaPrompt({
      identity: "你是蝶灵（SoulWing），当前用户的专属 AI 助手。",
      soul: "",
      userContext: "",
      rules: "",
    })
  }

  // Memory recall: search for relevant long-term memories based on user prompt
  let memoryContextText = ""
  try {
    const memoryCtx = await buildMemoryContext(params.userId, params.prompt, { limit: 5 })
    if (!memoryCtx.skipped && memoryCtx.contextText) {
      memoryContextText = memoryCtx.contextText
    }
  } catch {
    // Memory recall failure must not block conversation
  }

  const executions: AIToolExecutionRecord[] = []
  const reasoningParts: string[] = []
  let finalPlan: AIRuntimePlan = buildPlan("self", "模型将根据问题自行判断是否需要调用工具。", [])
  let contentMarkdown = ""
  const modelName = provider?.model ?? "structured-fallback"
  let assistantStepId: string | null = null

  const ensureAssistantStep = async () => {
    if (assistantStepId) return assistantStepId
    const step = await createStep(params, state, "assistant_output", "最终回答", "正在生成回答。")
    assistantStepId = step.id
    await emit(params, "assistant_started", {
      stepId: step.id,
      title: step.title,
      status: "running",
      summary: step.summary,
    })
    return step.id
  }

  if (!provider) {
    await emitCapabilityWarning(params, state, "provider-missing", "当前没有可用的 provider，已使用结构化降级结果。", {
      streamText: false,
      toolCalling: false,
      visionInput: false,
      reasoningStream: false,
    })
    const fallback = await runHeuristicFallback(params, state, "当前没有可用 provider，无法执行原生 agent loop。")
    finalPlan = fallback.plan
    executions.push(...fallback.executions)
    contentMarkdown = buildFallbackAnswer(params.prompt, executions, "当前没有可用 provider，以下是基于工具结果的结构化回答。")
    const stepId = await ensureAssistantStep()
    for (const chunk of chunkText(contentMarkdown)) {
      await params.onToken?.(chunk)
      await emit(params, "assistant_delta", { stepId, delta: chunk })
    }
    await completeAIRunStep(stepId, {
      status: "completed",
      summary: "结构化回答已生成。",
      outputPreview: { contentMarkdown, providerMetadata: { fallback: "no-provider" } },
    })
    await emit(params, "assistant_completed", {
      stepId,
      title: "最终回答",
      status: "completed",
      summary: "结构化回答已生成。",
      outputPreview: { contentMarkdown, providerMetadata: { fallback: "no-provider" } },
    })
  } else {
    const capabilities = provider.capabilities
    const hasImageAttachments = params.attachments.some((attachment) => attachment.mimeType.startsWith("image/"))
    let shouldAttemptVision = capabilities.visionInput || hasImageAttachments

    if (shouldUseHeuristicFallback(params.prompt, capabilities)) {
      await emitCapabilityWarning(params, state, "tools-unsupported", "当前 provider 不支持原生工具调用，已退回到受控工具兜底流程。", capabilities)
      const fallback = await runHeuristicFallback(params, state, "当前 provider 不支持原生工具调用，改用受控工具兜底流程。")
      finalPlan = fallback.plan
      executions.push(...fallback.executions)
      contentMarkdown = buildFallbackAnswer(params.prompt, executions)
      const stepId = await ensureAssistantStep()
      for (const chunk of chunkText(contentMarkdown)) {
        await params.onToken?.(chunk)
        await emit(params, "assistant_delta", { stepId, delta: chunk })
      }
      await completeAIRunStep(stepId, {
        status: "completed",
        summary: "回答已生成。",
        outputPreview: { contentMarkdown, providerMetadata: { fallback: "heuristic-tools" } },
      })
      await emit(params, "assistant_completed", {
        stepId,
        title: "最终回答",
        status: "completed",
        summary: "回答已生成。",
        outputPreview: { contentMarkdown, providerMetadata: { fallback: "heuristic-tools" } },
      })
    } else {
      const toolSpecs = capabilities.toolCalling ? buildProviderTools() : []
      const buildConversationMessages = async (canUseVision: boolean): Promise<ProviderMessage[]> => {
        const systemContent = buildRuntimeSystemPrompt({
          capabilities,
          canUseTools: capabilities.toolCalling,
          canUseVision,
          personaPrompt,
        })
        const finalSystemContent = memoryContextText
          ? `${systemContent}\n\n${memoryContextText}`
          : systemContent

        return [
          { role: "system", content: finalSystemContent },
          ...buildHistoryMessages(history),
          await buildUserMessage(params.prompt, canUseVision ? params.attachments : [], canUseVision),
        ]
      }
      let conversationMessages: ProviderMessage[] = await buildConversationMessages(shouldAttemptVision)

      const requestRound = async (
        reasoningStepId: string,
        reasoningStepTitle: string,
        reasoningStepSummary: string,
        onReasoningStarted: () => void,
      ) =>
        requestProviderChat({
          provider,
          messages: conversationMessages,
          tools: toolSpecs.length ? toolSpecs : undefined,
          toolChoice: toolSpecs.length ? "auto" : "none",
          stream: true,
          onReasoningStart: async () => {
            onReasoningStarted()
            await emit(params, "reasoning_started", {
              stepId: reasoningStepId,
              title: reasoningStepTitle,
              status: "running",
              summary: reasoningStepSummary,
            })
          },
          onReasoningDelta: async (delta) => {
            reasoningParts.push(delta)
            await emit(params, "reasoning_delta", { stepId: reasoningStepId, delta })
          },
          onAssistantStart: async () => {
            await ensureAssistantStep()
          },
          onAssistantDelta: async (delta) => {
            const stepId = await ensureAssistantStep()
            contentMarkdown += delta
            await params.onToken?.(delta)
            await emit(params, "assistant_delta", { stepId, delta })
          },
          onToolCallDelta: async (toolCall) => {
            await emit(params, "tool_call_argument_delta", {
              toolCallId: toolCall.id,
              toolName: toolCall.name,
              argumentsText: toolCall.argumentsText,
              argumentsDelta: toolCall.argumentsDelta,
            })
          },
        })

      let gotFinalAnswer = false

      for (let round = 0; round < MAX_AGENT_ROUNDS; round += 1) {
        const reasoningStep = await createStep(
          params,
          state,
          "reasoning",
          round === 0 ? "思考" : `继续思考 #${round + 1}`,
          "正在判断是否需要工具以及下一步动作。",
        )
        let reasoningStarted = false

        let result
        try {
          result = await requestRound(reasoningStep.id, reasoningStep.title, reasoningStep.summary, () => {
            reasoningStarted = true
          })
        } catch (error) {
          if (shouldAttemptVision && hasImageAttachments && isVisionRelatedProviderError(error)) {
            shouldAttemptVision = false
            conversationMessages = await buildConversationMessages(false)
            await emitCapabilityWarning(
              params,
              state,
              "vision-unsupported",
              "当前 provider 无法处理图片输入，已自动改为纯文本重试。",
              { ...capabilities, visionInput: false },
            )
            result = await requestRound(reasoningStep.id, reasoningStep.title, reasoningStep.summary, () => {
              reasoningStarted = true
            })
          } else {
            throw error
          }
        }

        const roundSummary = result.reasoningText || (
          result.toolCalls.length > 0
            ? `模型决定调用 ${result.toolCalls.length} 个工具。`
            : result.assistantText
              ? "模型已得出可直接回答的结论。"
              : "模型完成本轮判断。"
        )
        reasoningParts.push(roundSummary)
        if (!reasoningStarted) {
          await emit(params, "reasoning_started", {
            stepId: reasoningStep.id,
            title: reasoningStep.title,
            status: "running",
            summary: reasoningStep.summary,
          })
          await emit(params, "reasoning_delta", { stepId: reasoningStep.id, delta: roundSummary })
        }
        await completeAIRunStep(reasoningStep.id, {
          status: "completed",
          summary: roundSummary,
          outputPreview: {
            reasoning: result.reasoningText || roundSummary,
            providerMetadata: result.providerMetadata ?? null,
          },
        })
        await emit(params, "reasoning_completed", {
          stepId: reasoningStep.id,
          title: reasoningStep.title,
          status: "completed",
          summary: roundSummary,
          outputPreview: {
            reasoning: result.reasoningText || roundSummary,
            providerMetadata: result.providerMetadata ?? null,
          },
        })

        const wantsTools = result.toolCalls.length > 0 || result.finishReason === "tool_calls"
        if (wantsTools && executions.length < MAX_TOOL_CALLS) {
          const actor = await createAIToolActor(params.userId)
          const roundToolCalls = result.toolCalls.slice(0, MAX_TOOL_CALLS - executions.length)
          // Build one assistant message with ALL tool_calls for this round (required for parallel tool calls)
          const assistantToolCallMsg: ProviderMessage = {
            role: "assistant",
            content: result.assistantText || "",
            ...(result.reasoningText ? { reasoning_content: result.reasoningText } as Record<string, unknown> : {}),
            tool_calls: roundToolCalls.map((tc: ProviderToolCall) => ({
              id: tc.id,
              type: "function",
              function: { name: tc.name, arguments: tc.argumentsText },
            })),
          }
          conversationMessages.push(assistantToolCallMsg as ProviderMessage)
          for (const toolCall of roundToolCalls) {
            const execution = await executeToolCall(params, state, finalPlan, toolCall, actor)
            executions.push(execution)
            conversationMessages.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: formatToolResultForLLM(execution.result),
            })
          }
          finalPlan = buildPlan(
            executions.some((item) => item.scope === "admin-delegated")
              ? "admin-delegated"
              : executions.some((item) => item.scope === "visible-user")
                ? "visible-user"
                : "self",
            executions.length > 0 ? "模型已根据问题自主选择并执行工具。" : "模型未调用工具。",
            executions.map((item) => ({
              toolName: item.name,
              reason: item.title,
              input: item.input,
            })),
            executions.find((item) => item.input?.targetUserId && item.input.targetUserId !== params.userId)?.input?.targetUserId as string | null ?? null,
          )
          continue
        }

        // Only treat as final answer when there are NO tool calls at all
        if (result.assistantText && result.toolCalls.length === 0 && result.finishReason !== "tool_calls") {
          gotFinalAnswer = true
          const stepId = await ensureAssistantStep()
          await completeAIRunStep(stepId, {
            status: "completed",
            summary: "回答已生成。",
            outputPreview: {
              contentMarkdown,
              providerMetadata: result.providerMetadata ?? null,
            },
          })
          await emit(params, "assistant_completed", {
            stepId,
            title: "最终回答",
            status: "completed",
            summary: "回答已生成。",
            outputPreview: {
              contentMarkdown,
              providerMetadata: result.providerMetadata ?? null,
            },
          })
          break
        }
      }

      // If the loop exhausted all rounds without a final answer, force one more model call
      // WITHOUT tools to get a proper summary based on collected tool results
      if (!gotFinalAnswer && executions.length > 0) {
        const summaryPrompt: ProviderMessage = {
          role: "user",
          content: "请基于以上工具执行结果，用中文给出最终总结回答。不要调用任何工具，直接给出总结。",
        }
        conversationMessages.push(summaryPrompt)
        try {
          const summaryStep = await createStep(params, state, "reasoning", "生成最终总结", "正在综合工具结果生成最终回答。")
          await emit(params, "reasoning_started", {
            stepId: summaryStep.id,
            title: summaryStep.title,
            status: "running",
            summary: summaryStep.summary,
          })
          const summaryResult = await requestProviderChat({
            provider,
            messages: conversationMessages,
            stream: true,
            onAssistantStart: async () => {
              await ensureAssistantStep()
            },
            onAssistantDelta: async (delta) => {
              contentMarkdown += delta
              const stepId = await ensureAssistantStep()
              await params.onToken?.(delta)
              await emit(params, "assistant_delta", { stepId, delta })
            },
            onReasoningStart: async () => {
              await emit(params, "reasoning_started", { stepId: summaryStep.id, title: summaryStep.title, status: "running", summary: summaryStep.summary })
            },
            onReasoningDelta: async (delta) => {
              reasoningParts.push(delta)
              await emit(params, "reasoning_delta", { stepId: summaryStep.id, delta })
            },
          })
          await completeAIRunStep(summaryStep.id, {
            status: "completed",
            summary: "最终总结已生成。",
            outputPreview: { contentMarkdown, providerMetadata: summaryResult.providerMetadata ?? null },
          })
          await emit(params, "reasoning_completed", {
            stepId: summaryStep.id,
            title: summaryStep.title,
            status: "completed",
            summary: "最终总结已生成。",
            outputPreview: { contentMarkdown, providerMetadata: summaryResult.providerMetadata ?? null },
          })
          gotFinalAnswer = true
        } catch {
          // If summary call fails, fall through to fallback
        }
      }

      if (!contentMarkdown.trim()) {
        await emitCapabilityWarning(params, state, "provider-empty-response", "provider 没有返回最终回答，已回退为结构化结果。", capabilities)
        contentMarkdown = buildFallbackAnswer(params.prompt, executions, "provider 未返回有效回答。")
        const stepId = await ensureAssistantStep()
        for (const chunk of chunkText(contentMarkdown)) {
          await params.onToken?.(chunk)
          await emit(params, "assistant_delta", { stepId, delta: chunk })
        }
        await completeAIRunStep(stepId, {
          status: "completed",
          summary: "结构化回答已生成。",
          outputPreview: { contentMarkdown, providerMetadata: { fallback: "empty-provider-response" } },
        })
        await emit(params, "assistant_completed", {
          stepId,
          title: "最终回答",
          status: "completed",
          summary: "结构化回答已生成。",
          outputPreview: { contentMarkdown, providerMetadata: { fallback: "empty-provider-response" } },
        })
      }
    }
  }

  const reasoningSummary = buildReasoningSummary(reasoningParts)
  const toolTraceSummary = buildToolTraceSummary(executions)
  const runSummary = compactText(
    [reasoningSummary, executions.length ? `共调用 ${executions.length} 个工具。` : "未调用工具。"].join(" "),
    140,
  )

  await finalizeAIRun({
    runId: params.runId,
    status: "completed",
    summary: runSummary,
    finalModel: modelName,
  })

  await emit(params, "run_completed", {
    runId: params.runId,
    conversationId: params.conversationId,
    assistantMessageId: params.assistantMessageId,
    summary: runSummary,
    modelName,
  })

  const run = await getAIRunByMessageId(params.userId, params.assistantMessageId, true)

  return {
    contentMarkdown,
    reasoningSummary,
    toolTraceSummary,
    modelName,
    toolExecutions: executions,
    plan: finalPlan,
    compactSteps: run?.steps.map((item) => ({
      id: item.id,
      type: item.type,
      title: item.title,
      status: item.status,
      startedAt: item.startedAt,
      finishedAt: item.finishedAt,
      summary: item.summary,
      errorMessage: item.errorMessage,
    })) ?? [],
    runSummary,
  }
}
