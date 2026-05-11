import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { requestProviderChat } from "@/lib/ai/provider"
import { getEffectiveProviderConfig } from "@/lib/ai/service"
import { DEFAULT_AI_SUGGESTIONS, withDefaultAISuggestions } from "@/lib/ai/suggestions"

export const dynamic = "force-dynamic"

const NO_STORE = { "Cache-Control": "no-store" }

function formatDate(value: Date | null | undefined) {
  if (!value) return ""
  return value.toISOString().slice(0, 10)
}

function parseSuggestionPayload(text: string) {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim()

  const candidates = [
    cleaned,
    cleaned.match(/\[[\s\S]*\]/)?.[0] ?? "",
  ].filter(Boolean)

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate)
      if (Array.isArray(parsed)) return parsed
      if (parsed && typeof parsed === "object" && Array.isArray((parsed as { suggestions?: unknown }).suggestions)) {
        return (parsed as { suggestions: unknown[] }).suggestions
      }
    } catch {
      // Try the next extraction strategy.
    }
  }

  return cleaned
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(?:[-*]|\d+[.)、])\s*/, "").trim())
    .filter(Boolean)
}

async function buildSuggestionContext(userId: string) {
  const [user, posts, jobs, conversations, directMessages, channelMessages, memoryFacts] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { displayName: true, bio: true, location: true },
    }),
    prisma.post.findMany({
      where: { userId },
      orderBy: [{ date: "desc" }, { updatedAt: "desc" }],
      take: 8,
      select: { title: true, type: true, summary: true, date: true },
    }),
    prisma.jobApplication.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      take: 8,
      select: { company: true, position: true, status: true, appliedAt: true },
    }),
    prisma.aIConversation.findMany({
      where: { userId, deletedAt: null },
      orderBy: { lastMessageAt: "desc" },
      take: 6,
      select: { title: true, lastMessageAt: true, _count: { select: { messages: true } } },
    }),
    prisma.chatMessage.count({
      where: { OR: [{ senderId: userId }, { receiverId: userId }] },
    }),
    prisma.channelMessage.count({ where: { senderId: userId } }),
    prisma.memoryFact.count({ where: { userId, deletedAt: null } }),
  ])

  return [
    `用户：${user?.displayName || "未设置昵称"}`,
    user?.bio ? `简介：${user.bio}` : "",
    user?.location ? `地点：${user.location}` : "",
    `聊天消息数：${directMessages}，群聊发言数：${channelMessages}，长期记忆数：${memoryFacts}`,
    posts.length
      ? `最近内容：${posts.map((post) => `${post.type}/${post.title}/${formatDate(post.date)}${post.summary ? `/${post.summary.slice(0, 40)}` : ""}`).join("；")}`
      : "最近内容：暂无",
    jobs.length
      ? `求职记录：${jobs.map((job) => `${job.company}-${job.position}-${job.status}-${formatDate(job.appliedAt)}`).join("；")}`
      : "求职记录：暂无",
    conversations.length
      ? `最近 AI 会话：${conversations.map((item) => `${item.title}(${item._count.messages}条，${formatDate(item.lastMessageAt)})`).join("；")}`
      : "最近 AI 会话：暂无",
  ].filter(Boolean).join("\n")
}

export async function POST() {
  const session = await requireAuth()
  const provider = await getEffectiveProviderConfig(session.userId).catch(() => null)

  if (!provider) {
    return NextResponse.json({
      source: "fallback",
      generated: false,
      items: DEFAULT_AI_SUGGESTIONS,
    }, { headers: NO_STORE })
  }

  try {
    const context = await buildSuggestionContext(session.userId)
    const result = await requestProviderChat({
      provider: {
        ...provider,
        temperature: Math.max(provider.temperature ?? 0.7, 0.65),
      },
      stream: false,
      timeoutMs: 45_000,
      messages: [
        {
          role: "system",
          content: [
            "你是个人网站里的 AI 助手 SoulWing，负责为用户生成首页空会话的快捷提问建议。",
            "请只输出 JSON 字符串数组，不要 Markdown，不要解释。",
            "数组长度 15-20。",
            "每条建议必须是中文，可直接作为用户消息发送，长度 8-32 个汉字左右。",
            "建议要覆盖：文章写作、日常复盘、聊天关系、群聊动态、求职进展、面试准备、简历、个人主页、长期记忆、资料搜索。",
            "避免重复、空泛和调试口吻，不要提到你在生成建议。",
          ].join("\n"),
        },
        {
          role: "user",
          content: `根据下面用户站内概况，生成一组有行动感的快捷提问建议：\n\n${context}`,
        },
      ],
    })

    const items = withDefaultAISuggestions(parseSuggestionPayload(result.assistantText), 15, 20)

    return NextResponse.json({
      source: "ai",
      generated: true,
      items,
    }, { headers: NO_STORE })
  } catch {
    return NextResponse.json({
      source: "fallback",
      generated: false,
      items: DEFAULT_AI_SUGGESTIONS,
    }, { headers: NO_STORE })
  }
}
