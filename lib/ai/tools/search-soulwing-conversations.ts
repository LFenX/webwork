import "server-only"
import type { Prisma } from "@/app/generated/prisma/client"
import { prisma } from "@/lib/db"
import { toolGranted, toolForbidden } from "@/lib/ai/tools/helpers"

// ── Time range resolution ────────────────────────────────────────────────────

function resolveTimeRange(
  timeRange?: string,
  since?: string,
  until?: string,
): { since: Date; until: Date; label: string } {
  const now = new Date()
  const untilDate = until ? new Date(until) : now

  if (since) {
    return { since: new Date(since), until: untilDate, label: `${since} ~ ${until || "now"}` }
  }

  const hoursMap: Record<string, number> = {
    "1h": 1, "2h": 2, "6h": 6, "24h": 24, "7d": 168, "30d": 720, "all": -1,
  }

  const hours = timeRange ? (hoursMap[timeRange] ?? 2) : 2
  const sinceDate = hours === -1
    ? new Date(0)
    : new Date(now.getTime() - hours * 3600000)

  const labelMap: Record<string, string> = {
    "1h": "过去1小时", "2h": "过去2小时", "6h": "过去6小时",
    "24h": "过去24小时", "7d": "过去7天", "30d": "过去30天", "all": "全部时间",
  }
  const label = timeRange ? (labelMap[timeRange] ?? `自定义(${timeRange})`) : "过去2小时"

  return { since: sinceDate, until: untilDate, label }
}

function normalizeLimit(n: number | undefined, fallback: number, max: number): number {
  if (!Number.isFinite(n)) return fallback
  return Math.min(Math.max(Math.trunc(n as number), 1), max)
}

function truncateContent(value: string, maxChars: number): string {
  const text = value.replace(/\s+/g, " ").trim()
  if (text.length <= maxChars) return text
  return `${text.slice(0, maxChars - 3)}...`
}

// ── Tool definition ──────────────────────────────────────────────────────────

export const searchSoulWingConversationsTool = {
  name: "search_soulwing_conversations",
  title: "搜索蝶灵对话历史",
  description:
    "查询当前用户与蝶灵 SoulWing 的 AI 对话历史，支持按时间、模式（统计/主题/摘要/消息）查询。",

  scope: "self" as const,
  inputSchemaSummary:
    "mode?: count|topics|summary|messages, timeRange?: 1h|2h|6h|24h|7d|30d|all, since?: string, until?: string, query?: string, limit?: number",
  sensitivity: "high" as const,
  auditLabel: "search_soulwing_conversations",

  whenToUse: [
    "当用户说【我跟你聊了几次】【我最近和你聊了什么】【我们之前聊过什么主题】【你记得我之前问过你什么吗】时使用。",
    "当用户询问与蝶灵（SoulWing / AI 助手）的对话历史、对话统计、对话主题时使用。",
    "当用户追问时间范围（【那过去一天呢】【那上周呢】）时继续使用。",
    "这是查询用户与 AI 助手对话历史的唯一工具——不是好友聊天工具，不是群聊工具，不是活动日志。",
  ].join(" "),

  whenNotToUse: [
    "不要用于查询用户与好友的聊天记录——应使用 search_my_chat_messages。",
    "不要用于查询群聊消息——应使用 get_channel_messages。",
    "不要用于查询登录记录或操作日志——应使用 get_my_activity_log。",
    "不要用于查询/保存长期记忆偏好——应使用 search_user_memory / save_user_memory。",
    "不要在问题明确指好友或群聊时使用。",
  ].join(" "),

  argumentHints: [
    "mode 可选值：count（统计次数）/ topics（对话主题）/ summary（对话摘要）/ messages（具体消息），默认 topics",
    "timeRange 可选值：1h / 2h / 6h / 24h / 7d / 30d / all，默认根据用户问题推断",
    "since/until 为自定义时间范围 ISO 字符串，与 timeRange 互斥",
    "query 为可选关键词，在 topics/summary/messages 模式下用于过滤",
    "limit 最大值 50，topics 默认 20，summary 默认 5，messages 默认 10",
  ],

  returns: "根据 mode 返回：count 返回对话次数/消息数统计；topics 返回对话主题列表；summary 返回对话摘要；messages 返回具体消息内容预览。",

  parameterSchema: {
    type: "object",
    properties: {
      mode: {
        type: "string",
        enum: ["count", "topics", "summary", "messages"],
        description: "Query mode: count=statistics, topics=conversation topics, summary=conversation summaries, messages=message content previews. Defaults to topics.",
      },
      timeRange: {
        type: "string",
        enum: ["1h", "2h", "6h", "24h", "7d", "30d", "all"],
        description: "Preset time range. Mutually exclusive with since/until. Defaults to 2h when not specified.",
      },
      since: {
        type: "string",
        description: "Custom start ISO datetime. Overrides timeRange start.",
      },
      until: {
        type: "string",
        description: "Custom end ISO datetime. Defaults to now.",
      },
      query: {
        type: "string",
        description: "Optional keyword filter for topics/summary/messages modes.",
      },
      limit: {
        type: "integer",
        minimum: 1,
        maximum: 50,
        description: "Max items to return. count mode ignores this. topics default 20. summary default 5. messages default 10.",
      },
    },
    additionalProperties: false,
  },

  execute: async ({
    userId,
    mode,
    timeRange,
    since,
    until,
    query,
    limit,
  }: {
    userId: string
    mode?: string
    timeRange?: string
    since?: string
    until?: string
    query?: string
    limit?: number
  }) => {
    const resolvedMode = mode ?? "topics"
    const range = resolveTimeRange(timeRange, since, until)

    if (!["count", "topics", "summary", "messages"].includes(resolvedMode)) {
      return toolForbidden(`无效的 mode "${resolvedMode}"，可选值：count、topics、summary、messages。`, "invalid_mode")
    }

    // ── count mode ─────────────────────────────────────────────────────────

    if (resolvedMode === "count") {
      const [conversationCount, messageRows] = await Promise.all([
        prisma.aIConversation.count({
          where: {
            userId,
            deletedAt: null,
            lastMessageAt: { gte: range.since, lte: range.until },
          },
        }),
        prisma.aIMessage.groupBy({
          by: ["role"],
          where: {
            userId,
            createdAt: { gte: range.since, lte: range.until },
          },
          _count: { _all: true },
        }),
      ])

      let userMessages = 0
      let assistantMessages = 0
      for (const row of messageRows) {
        if (row.role === "user") userMessages = row._count._all
        else if (row.role === "assistant") assistantMessages = row._count._all
      }
      const totalMessages = userMessages + assistantMessages

      // Get first and last message timestamps
      const [firstMsg, lastMsg] = await Promise.all([
        prisma.aIMessage.findFirst({
          where: { userId, createdAt: { gte: range.since, lte: range.until } },
          orderBy: { createdAt: "asc" },
          select: { createdAt: true },
        }),
        prisma.aIMessage.findFirst({
          where: { userId, createdAt: { gte: range.since, lte: range.until } },
          orderBy: { createdAt: "desc" },
          select: { createdAt: true },
        }),
      ])

      let summary = `${range.label}内，你与蝶灵共有 ${conversationCount} 个会话，${totalMessages} 条消息`
      if (userMessages > 0 || assistantMessages > 0) {
        summary += `（你发了 ${userMessages} 条，蝶灵回复 ${assistantMessages} 条）`
      } else {
        summary += "（暂无消息）"
      }
      summary += "。"

      return toolGranted(summary, {
        mode: "count",
        timeRange: { since: range.since.toISOString(), until: range.until.toISOString(), label: range.label },
        conversations: conversationCount,
        userMessages,
        assistantMessages,
        totalMessages,
        firstMessageAt: firstMsg?.createdAt.toISOString() ?? null,
        lastMessageAt: lastMsg?.createdAt.toISOString() ?? null,
      })
    }

    // ── topics mode ─────────────────────────────────────────────────────────

    if (resolvedMode === "topics") {
      const maxLimit = normalizeLimit(limit, 20, 50)

      const events = await prisma.memoryEvent.findMany({
        where: {
          userId,
          deletedAt: null,
          createdAt: { gte: range.since, lte: range.until },
        },
        orderBy: { createdAt: "desc" },
        take: maxLimit,
        select: {
          id: true,
          conversationId: true,
          topicSummary: true,
          keywords: true,
          relatedModules: true,
          importance: true,
          createdAt: true,
        },
      })

      // If no MemoryEvent yet, fall back to AIConversation titles
      const items = await Promise.all(
        events.map(async (evt) => {
          let conversationTitle = ""
          try {
            const conv = await prisma.aIConversation.findFirst({
              where: { id: evt.conversationId ?? "", userId },
              select: { title: true },
            })
            conversationTitle = conv?.title ?? ""
          } catch { /* conversation may have been deleted */ }

          const msgCount = evt.conversationId
            ? await prisma.aIMessage.count({
                where: {
                  userId,
                  conversationId: evt.conversationId,
                  createdAt: { gte: range.since, lte: range.until },
                },
              })
            : 0

          return {
            conversationId: evt.conversationId ?? "",
            conversationTitle,
            topicSummary: evt.topicSummary,
            keywords: parseJsonArray(evt.keywords),
            relatedModules: parseJsonArray(evt.relatedModules),
            importance: evt.importance,
            messageCount: msgCount,
            createdAt: evt.createdAt.toISOString(),
          }
        }),
      )

      // Fallback: query AIMessage directly if no MemoryEvent
      if (items.length === 0) {
        // Get conversation titles from AIConversation
        const conversations = await prisma.aIConversation.findMany({
          where: {
            userId,
            deletedAt: null,
            lastMessageAt: { gte: range.since, lte: range.until },
          },
          orderBy: { lastMessageAt: "desc" },
          take: Math.min(maxLimit, 10),
          select: { id: true, title: true, lastMessageAt: true },
        })

        const fallbackItems = await Promise.all(
          conversations.map(async (conv) => {
            const msgCount = await prisma.aIMessage.count({
              where: {
                userId,
                conversationId: conv.id,
                createdAt: { gte: range.since, lte: range.until },
              },
            })

            return {
              conversationId: conv.id,
              conversationTitle: conv.title,
              topicSummary: conv.title,
              keywords: [] as string[],
              relatedModules: [] as string[],
              importance: "low",
              messageCount: msgCount,
              createdAt: conv.lastMessageAt.toISOString(),
            }
          }),
        )

        const summary = fallbackItems.length > 0
          ? `${range.label}内共 ${fallbackItems.length} 个对话主题。`
          : `${range.label}内没有找到对话记录。`

        return toolGranted(summary, {
          mode: "topics",
          timeRange: { since: range.since.toISOString(), until: range.until.toISOString(), label: range.label },
          topics: fallbackItems,
        })
      }

      const summary = items.length > 0
        ? `${range.label}内共 ${items.length} 个对话主题：${items.map((t) => t.topicSummary).join("；")}`
        : `${range.label}内没有找到对话主题。`

      return toolGranted(summary, {
        mode: "topics",
        timeRange: { since: range.since.toISOString(), until: range.until.toISOString(), label: range.label },
        topics: items,
      })
    }

    // ── summary mode ────────────────────────────────────────────────────────

    if (resolvedMode === "summary") {
      const maxLimit = normalizeLimit(limit, 5, 20)

      let eventWhere: Prisma.MemoryEventWhereInput = {
        userId,
        deletedAt: null,
        createdAt: { gte: range.since, lte: range.until },
      }
      if (query?.trim()) {
        eventWhere = {
          ...eventWhere,
          OR: [
            { topicSummary: { contains: query.trim(), mode: "insensitive" } },
            { keyTakeaways: { contains: query.trim(), mode: "insensitive" } },
          ],
        }
      }

      const events = await prisma.memoryEvent.findMany({
        where: eventWhere,
        orderBy: [{ importance: "desc" as const }, { createdAt: "desc" as const }],
        take: maxLimit,
        select: {
          id: true,
          conversationId: true,
          topicSummary: true,
          keyTakeaways: true,
          relatedModules: true,
          keywords: true,
          importance: true,
          createdAt: true,
        },
      })

      const items = await Promise.all(
        events.map(async (evt) => {
          const msgCount = evt.conversationId
            ? await prisma.aIMessage.count({
                where: {
                  userId,
                  conversationId: evt.conversationId,
                  createdAt: { gte: range.since, lte: range.until },
                },
              })
            : 0

          return {
            conversationId: evt.conversationId ?? "",
            topicSummary: evt.topicSummary,
            keyTakeaways: evt.keyTakeaways,
            relatedModules: parseJsonArray(evt.relatedModules),
            keywords: parseJsonArray(evt.keywords),
            importance: evt.importance,
            messageCount: msgCount,
            createdAt: evt.createdAt.toISOString(),
          }
        }),
      )

      if (items.length === 0) {
        return toolGranted(
          `${range.label}内没有找到相关对话摘要。`,
          {
            mode: "summary",
            timeRange: { since: range.since.toISOString(), until: range.until.toISOString(), label: range.label },
            summaries: [],
          },
        )
      }

      const summary = items.length > 0
        ? `${range.label}内共 ${items.length} 条对话摘要。`
        : `${range.label}内没有找到对话摘要。`

      return toolGranted(summary, {
        mode: "summary",
        timeRange: { since: range.since.toISOString(), until: range.until.toISOString(), label: range.label },
        summaries: items,
      })
    }

    // ── messages mode ───────────────────────────────────────────────────────

    const maxLimit = normalizeLimit(limit, 10, 50)

    let msgWhere: Record<string, unknown> = {
      userId,
      createdAt: { gte: range.since, lte: range.until },
    }
    if (query?.trim()) {
      msgWhere = {
        ...msgWhere,
        contentMarkdown: { contains: query.trim(), mode: "insensitive" },
      }
    }

    const messages = await prisma.aIMessage.findMany({
      where: msgWhere,
      orderBy: { createdAt: "desc" },
      take: maxLimit,
      select: {
        id: true,
        conversationId: true,
        role: true,
        contentMarkdown: true,
        createdAt: true,
      },
    })

    const items = messages.map((msg) => ({
      conversationId: msg.conversationId,
      role: msg.role as "user" | "assistant",
      contentPreview: truncateContent(msg.contentMarkdown, 200),
      createdAt: msg.createdAt.toISOString(),
    }))

    const userCount = items.filter((m) => m.role === "user").length
    const assistantCount = items.filter((m) => m.role === "assistant").length

    const summary = items.length > 0
      ? `${range.label}内共 ${items.length} 条消息（你 ${userCount} 条，蝶灵 ${assistantCount} 条）。`
      : `${range.label}内没有找到对话消息。`

    return toolGranted(summary, {
      mode: "messages",
      timeRange: { since: range.since.toISOString(), until: range.until.toISOString(), label: range.label },
      messages: items,
    })
  },
}

function parseJsonArray(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : []
  } catch {
    return []
  }
}
