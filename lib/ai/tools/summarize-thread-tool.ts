import "server-only"
import { prisma } from "@/lib/db"
import { getChannelForUser } from "@/lib/channel-chat"
import { getEffectiveProviderConfig } from "@/lib/ai/service"
import { requestProviderChat } from "@/lib/ai/provider"
import { loadAgentPersonaContext, buildAgentPersonaPrompt } from "@/lib/ai/agent-profile-service"
import { toolGranted, toolForbidden } from "@/lib/ai/tools/helpers"

function formatMessagesForSummarization(
  messages: Array<{ senderId: string; text: string; stickerEmoji: string | null; createdAt: Date; sender: { displayName: string; email: string } | null }>,
  currentUserId: string,
): string {
  return messages
    .map((m) => {
      const isMe = m.senderId === currentUserId
      const name = isMe ? "我" : (m.sender?.displayName || m.sender?.email || "未知")
      const text = m.text || m.stickerEmoji || "[表情]"
      return `[${m.createdAt.toISOString()}] ${name}: ${text}`
    })
    .join("\n")
}

const SUMMARIZE_SYSTEM_PROMPT = [
  "你是蝶灵（SoulWing）。",
  "你的任务：将以下聊天记录总结为一段简短摘要（不超过 200 字）。",
  "摘要应包括：",
  "- 聊了什么主题",
  "- 有什么重要结论或决定",
  "- 如果有待办事项请列出",
  "只输出摘要，不要解释。不要用 markdown 标题。",
].join(" ")

export const summarizeChatThreadTool = {
  name: "summarize_chat_thread",
  title: "总结聊天线程",
  description:
    "对一段聊天记录（单聊或群聊）做主题摘要。触发语：'总结一下我们的聊天''这个群最近聊了什么''帮我看聊天重点'。",
  scope: "self" as const,
  inputSchemaSummary:
    "peerHint?: string, channelId?: string, kind?: direct|channel, limit?: number",
  sensitivity: "high" as const,
  auditLabel: "summarize_chat_thread",
  whenToUse:
    "当用户想了解与好友或群聊的聊天内容摘要时使用。需要是聊天参与者（单聊需是好友，群聊需是成员）。注意：本工具总结的是好友聊天或群聊，不是 AI 对话。如果用户说【总结一下我们的聊天】且上下文指 AI 对话，应使用 search_soulwing_conversations (mode=summary)。",
  whenNotToUse:
    "不要在没有聊天访问权限时使用。不要用于搜索具体消息（用 search_my_chat_messages）。重要：不要用于总结用户与蝶灵 SoulWing 的 AI 对话——那是 search_soulwing_conversations 的职责。",
  argumentHints: [
    "peerHint：单聊时传好友昵称、邮箱或 id",
    "channelId：群聊时传频道 id",
    "kind：默认 direct",
    "limit：默认 30 条，最多 100 条",
  ],
  returns: "聊天摘要文本和消息数量",
  parameterSchema: {
    type: "object",
    properties: {
      kind: { type: "string", enum: ["direct", "channel"], description: "Chat kind, defaults to direct." },
      peerHint: { type: "string", description: "Friend identifier for direct chat." },
      channelId: { type: "string", description: "Channel id for group chat." },
      limit: { type: "integer", minimum: 10, maximum: 100, description: "Max messages to summarize, defaults to 30." },
    },
    additionalProperties: false,
  },
  execute: async ({
    userId,
    kind,
    peerHint,
    channelId,
    limit,
  }: {
    userId: string
    kind?: string
    peerHint?: string
    channelId?: string
    limit?: number
  }) => {
    const resolvedKind = (kind || "direct") as "direct" | "channel"
    const actualLimit = Math.min(Math.max(limit ?? 30, 10), 100)

    let messages: Array<{ senderId: string; text: string; stickerEmoji: string | null; createdAt: Date; sender: { displayName: string; email: string } | null }> = []
    let sceneLabel = ""

    if (resolvedKind === "channel") {
      if (!channelId?.trim()) {
        return toolForbidden("群聊总结需要提供 channelId。", "channel_id_required")
      }
      const channel = await getChannelForUser(userId, channelId.trim())
      if (!channel) {
        return toolForbidden("没有找到该群聊，或你不在该群中。", "channel_not_found_or_forbidden")
      }
      sceneLabel = `群聊「${(channel as Record<string, unknown>).name || channelId}」`

      const fetched = await prisma.channelMessage.findMany({
        where: { channelId: channelId.trim() },
        orderBy: { createdAt: "desc" },
        take: actualLimit,
        include: {
          sender: { select: { id: true, displayName: true, email: true } },
        },
      })
      messages = fetched.reverse()
    } else {
      if (!peerHint?.trim()) {
        return toolForbidden("单聊总结需要提供 peerHint（好友昵称、邮箱或 id）。", "peer_hint_required")
      }

      const targetUser = await prisma.user.findFirst({
        where: {
          OR: [
            { id: peerHint.trim() },
            { email: peerHint.trim().toLowerCase() },
            { displayName: { contains: peerHint.trim(), mode: "insensitive" } },
          ],
        },
        select: { id: true, displayName: true, email: true },
      })

      if (!targetUser) {
        return toolForbidden(`没有找到匹配 "${peerHint.trim()}" 的用户。`, "peer_not_found")
      }

      const friendship = await prisma.friendship.findFirst({
        where: {
          OR: [
            { userAId: userId, userBId: targetUser.id },
            { userAId: targetUser.id, userBId: userId },
          ],
        },
      })
      if (!friendship) {
        return toolForbidden(`你和 ${targetUser.displayName || targetUser.email} 还不是好友。`, "not_friends")
      }

      sceneLabel = `与 ${targetUser.displayName || targetUser.email} 的单聊`

      const fetched = await prisma.chatMessage.findMany({
        where: {
          OR: [
            { senderId: userId, receiverId: targetUser.id },
            { senderId: targetUser.id, receiverId: userId },
          ],
        },
        orderBy: { createdAt: "desc" },
        take: actualLimit,
        include: {
          sender: { select: { id: true, displayName: true, email: true } },
        },
      })
      messages = fetched.reverse()
    }

    if (messages.length === 0) {
      return toolGranted(`${sceneLabel} 暂无消息可供总结。`, {
        summary: "暂无消息",
        messageCount: 0,
        scene: sceneLabel,
      })
    }

    // Try to get summary from LLM
    const chatContext = formatMessagesForSummarization(messages, userId)

    try {
      const provider = await getEffectiveProviderConfig(userId)
      if (!provider) {
        return toolForbidden("没有可用的 AI provider，无法生成摘要。", "no_provider")
      }

      const userPrompt = [
        `场景：${sceneLabel}`,
        `共 ${messages.length} 条消息：`,
        chatContext,
        "\n请总结这段聊天。",
      ].join("\n")

      let personaPrompt = ""
      try {
        const persona = await loadAgentPersonaContext(userId)
        personaPrompt = buildAgentPersonaPrompt(persona)
      } catch { /* use default */ }

      const systemContent = [SUMMARIZE_SYSTEM_PROMPT, personaPrompt].filter(Boolean).join("\n\n")

      const result = await requestProviderChat({
        provider,
        messages: [
          { role: "system", content: systemContent },
          { role: "user", content: userPrompt },
        ],
        stream: false,
        onAssistantStart: () => {},
        onAssistantDelta: () => {},
      })

      const summary = (result.assistantText || "").trim()

      return toolGranted(
        summary
          ? `${sceneLabel} 的聊天摘要：\n${summary}`
          : `${sceneLabel}：生成了 ${messages.length} 条消息的摘要。`,
        {
          summary: summary || "摘要生成失败",
          messageCount: messages.length,
          scene: sceneLabel,
          firstMessageAt: messages[0]?.createdAt.toISOString() ?? null,
          lastMessageAt: messages[messages.length - 1]?.createdAt.toISOString() ?? null,
        },
      )
    } catch {
      return toolForbidden("生成摘要时出错，请稍后重试。", "summarize_error")
    }
  },
}
