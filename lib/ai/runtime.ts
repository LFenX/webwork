import "server-only"
import { AI_TOOL_MAP } from "@/lib/ai/tools/registry"
import {
  completeAIToolCallLog,
  createAIToolCallLog,
  getEffectiveProviderConfig,
  listRecentConversationHistory,
} from "@/lib/ai/service"
import type {
  AIConversationHistoryEntry,
  AIRuntimeResponse,
  AIToolExecutionRecord,
} from "@/lib/ai/types"

type RuntimeParams = {
  userId: string
  conversationId: string
  assistantMessageId: string
  prompt: string
  onToken?: (chunk: string) => Promise<void> | void
}

const TOOL_KEYWORDS: Array<{ name: string; keywords: string[] }> = [
  { name: "get_my_profile", keywords: ["资料", "profile", "个人信息", "bio", "location"] },
  { name: "get_my_settings", keywords: ["设置", "偏好", "language", "语言", "settings"] },
  { name: "get_my_resume_overview", keywords: ["简历", "resume", "pdf", "版本"] },
  { name: "get_my_jobs_overview", keywords: ["求职", "投递", "工作申请", "jobs", "job", "offer"] },
  { name: "get_my_interviews_overview", keywords: ["面试", "interview", "通过率", "轮次"] },
  { name: "get_my_posts_overview", keywords: ["文章", "blog", "daily", "notes", "reflections", "笔记", "内容"] },
  { name: "get_my_uploads_overview", keywords: ["上传", "附件", "文件", "upload"] },
  { name: "get_my_friends_overview", keywords: ["好友", "朋友", "friend"] },
  { name: "get_my_chat_summary", keywords: ["聊天", "消息", "私聊", "频道", "chat"] },
  { name: "get_visible_user_page_overview", keywords: ["主页", "可见", "别人页面", "user page"] },
]

function getToolInput(prompt: string, toolName: string) {
  if (toolName !== "get_visible_user_page_overview") return null

  const cuidMatch = prompt.match(/\b[a-z0-9]{20,}\b/i)
  const pathMatch = prompt.match(/\/u\/([a-z0-9]+)/i)
  const targetUserId = pathMatch?.[1] ?? cuidMatch?.[0]
  return targetUserId ? { targetUserId } : null
}

function selectToolNames(prompt: string) {
  const normalized = prompt.toLowerCase()
  const selected = new Set<string>()

  for (const item of TOOL_KEYWORDS) {
    if (item.keywords.some((keyword) => normalized.includes(keyword.toLowerCase()))) {
      selected.add(item.name)
    }
  }

  if (/总结|概览|总览|最近|现状|overview|summary/.test(prompt)) {
    selected.add("get_my_profile")
  }

  if (selected.size === 0) {
    selected.add("get_my_profile")
    selected.add("get_my_settings")
  }

  return Array.from(selected)
}

function buildReasoningSummary(prompt: string, executions: AIToolExecutionRecord[]) {
  if (executions.length === 0) {
    return "这次问题没有命中需要读取的受控工具，系统直接按当前上下文组织回答。"
  }

  const shortPrompt = `${prompt.slice(0, 48)}${prompt.length > 48 ? "..." : ""}`
  return `系统先根据问题“${shortPrompt}”匹配受控工具，再基于工具结果生成回答。共执行 ${executions.length} 个工具。`
}

function buildToolTraceSummary(executions: AIToolExecutionRecord[]) {
  if (executions.length === 0) {
    return "未调用工具。"
  }

  return executions
    .map((item) => `${item.title}（${item.name}）：${item.status === "completed" ? "已完成" : `失败 - ${item.error || "未知错误"}`}`)
    .join("\n")
}

function buildFallbackAnswer(prompt: string, executions: AIToolExecutionRecord[]) {
  if (executions.length === 0) {
    return [
      "我没有在这次问题里匹配到需要读取的受控数据工具。",
      "",
      "你可以继续明确说明想看的信息，例如：",
      "- 总结我最近一周的求职进展",
      "- 看看我的简历版本和当前状态",
      "- 帮我概览最近的文章、notes 和 reflections",
    ].join("\n")
  }

  const sections = executions.map((item) => {
    if (item.status === "failed") {
      return `## ${item.title}\n\n工具执行失败：${item.error || "未知错误"}`
    }

    return `## ${item.title}\n\n\`\`\`json\n${JSON.stringify(item.result, null, 2)}\n\`\`\``
  })

  return [
    "我已经根据你当前权限内可访问的数据整理了这次结果。",
    "",
    `问题：${prompt}`,
    "",
    ...sections,
    "",
    "如果你愿意，我下一步可以继续把这些数据整理成更自然的分析结论、行动建议，或按时间线做总结。",
  ].join("\n")
}

function splitIntoChunks(value: string, size: number) {
  const chunks: string[] = []
  for (let index = 0; index < value.length; index += size) {
    chunks.push(value.slice(index, index + size))
  }
  return chunks
}

function buildModelMessages(params: {
  prompt: string
  history: AIConversationHistoryEntry[]
  executions: AIToolExecutionRecord[]
}) {
  const toolContext = params.executions
    .map((item) => `工具：${item.title} (${item.name})\n状态：${item.status}\n结果：${JSON.stringify(item.result)}`)
    .join("\n\n")

  return [
    {
      role: "system",
      content:
        "你是站内 AI 助手。你只能基于提供给你的聊天上下文和受控工具结果回答，不得编造数据，不得声称读取了未提供的数据。请用清晰、简洁、结构化的中文回答；如果信息不足，请明确说明。",
    },
    ...params.history
      .filter((item) => item.content.trim())
      .map((item) => ({
        role: item.role,
        content: item.content,
      })),
    {
      role: "user",
      content: [
        `用户当前问题：${params.prompt}`,
        "",
        "下面是本次已执行的受控工具结果，请基于它们回答：",
        toolContext || "本次没有工具结果。",
      ].join("\n"),
    },
  ]
}

async function streamOpenAICompatibleResponse(params: {
  baseUrl: string
  apiKey: string
  model: string
  temperature: number
  streamEnabled: boolean
  messages: Array<{ role: string; content: string }>
  onToken?: (chunk: string) => Promise<void> | void
}) {
  const endpoint = `${params.baseUrl.replace(/\/+$/, "")}/chat/completions`
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: params.model,
      temperature: params.temperature,
      stream: params.streamEnabled,
      messages: params.messages,
    }),
    cache: "no-store",
  })

  if (!response.ok) {
    const text = await response.text().catch(() => "")
    throw new Error(text || `Provider request failed with status ${response.status}`)
  }

  if (!params.streamEnabled) {
    const payload = await response.json()
    const text = payload?.choices?.[0]?.message?.content
    if (typeof text !== "string" || !text.trim()) {
      throw new Error("Provider returned an empty response")
    }
    if (params.onToken) {
      for (const chunk of text.match(/.{1,80}/g) ?? [text]) {
        await params.onToken(chunk)
      }
    }
    return text
  }

  if (!response.body) {
    throw new Error("Provider stream is unavailable")
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  let built = ""

  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split("\n")
    buffer = lines.pop() ?? ""

    for (const rawLine of lines) {
      const line = rawLine.trim()
      if (!line.startsWith("data:")) continue

      const data = line.slice(5).trim()
      if (!data || data === "[DONE]") continue

      const payload = JSON.parse(data)
      const delta = payload?.choices?.[0]?.delta?.content
      if (typeof delta === "string" && delta.length > 0) {
        built += delta
        if (params.onToken) {
          await params.onToken(delta)
        }
      }
    }
  }

  if (!built.trim()) {
    throw new Error("Provider returned an empty streaming response")
  }

  return built
}

async function executeSelectedTools(params: {
  userId: string
  conversationId: string
  assistantMessageId: string
  prompt: string
}) {
  const toolNames = selectToolNames(params.prompt)
  const executions: AIToolExecutionRecord[] = []

  for (const toolName of toolNames) {
    const tool = AI_TOOL_MAP.get(toolName)
    if (!tool) continue

    const input = getToolInput(params.prompt, toolName)
    const log = await createAIToolCallLog({
      conversationId: params.conversationId,
      messageId: params.assistantMessageId,
      userId: params.userId,
      toolName,
      toolInputJson: input ?? undefined,
    })

    try {
      const result = await tool.execute({
        userId: params.userId,
        ...(input ?? {}),
      })

      await completeAIToolCallLog(log.id, result, "completed")
      executions.push({
        name: tool.name,
        title: tool.title,
        description: tool.description,
        input,
        result,
        status: "completed",
      })
    } catch (error) {
      const failurePayload = { error: error instanceof Error ? error.message : "Unknown tool error" }
      await completeAIToolCallLog(log.id, failurePayload, "failed")
      executions.push({
        name: tool.name,
        title: tool.title,
        description: tool.description,
        input,
        result: failurePayload,
        status: "failed",
        error: failurePayload.error,
      })
    }
  }

  return executions
}

export async function runAIRuntime(params: RuntimeParams): Promise<AIRuntimeResponse> {
  const executions = await executeSelectedTools(params)
  const reasoningSummary = buildReasoningSummary(params.prompt, executions)
  const toolTraceSummary = buildToolTraceSummary(executions)
  const history = await listRecentConversationHistory(params.userId, params.conversationId, 10)
  const provider = await getEffectiveProviderConfig(params.userId)

  if (provider) {
    try {
      const contentMarkdown = await streamOpenAICompatibleResponse({
        baseUrl: provider.baseUrl,
        apiKey: provider.apiKey,
        model: provider.model,
        temperature: provider.temperature,
        streamEnabled: provider.streamEnabled,
        messages: buildModelMessages({
          prompt: params.prompt,
          history,
          executions,
        }),
        onToken: params.onToken,
      })

      return {
        contentMarkdown,
        reasoningSummary,
        toolTraceSummary,
        modelName: provider.model,
        toolExecutions: executions,
      }
    } catch (error) {
      const fallbackIntro = `> provider 调用失败，已回退到结构化摘要模式：${error instanceof Error ? error.message : "未知错误"}\n\n`
      const fallbackContent = fallbackIntro + buildFallbackAnswer(params.prompt, executions)

      if (params.onToken) {
        for (const chunk of splitIntoChunks(fallbackContent, 100)) {
          await params.onToken(chunk)
        }
      }

      return {
        contentMarkdown: fallbackContent,
        reasoningSummary,
        toolTraceSummary,
        modelName: `${provider.model} (fallback)`,
        toolExecutions: executions,
      }
    }
  }

  const fallbackContent = buildFallbackAnswer(params.prompt, executions)
  if (params.onToken) {
    for (const chunk of splitIntoChunks(fallbackContent, 100)) {
      await params.onToken(chunk)
    }
  }

  return {
    contentMarkdown: fallbackContent,
    reasoningSummary,
    toolTraceSummary,
    modelName: "structured-fallback",
    toolExecutions: executions,
  }
}
