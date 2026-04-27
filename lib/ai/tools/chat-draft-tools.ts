import "server-only"
import { prisma } from "@/lib/db"
import { getChannelForUser } from "@/lib/channel-chat"
import { toolGranted, toolForbidden } from "@/lib/ai/tools/helpers"

export const sendDraftChatMessageTool = {
  name: "send_draft_chat_message",
  title: "草拟聊天回复",
  description:
    "为指定对话草拟一条聊天回复，不实际发送。用户可在 UI 中确认后发送。触发语：'帮我回复他''帮我在群里回一句''替我起草一条消息'。",
  scope: "self" as const,
  inputSchemaSummary:
    "peerHint?: string, channelId?: string, text: string, kind?: direct|channel",
  sensitivity: "high" as const,
  auditLabel: "draft_chat_message",
  whenToUse:
    "当用户要求帮忙起草聊天回复（单聊或群聊）时使用。返回草案供用户确认。",
  whenNotToUse:
    "不要实际发送消息。不要在没有用户明确要求时起草。不要用于群发。",
  argumentHints: [
    "text：必填，草稿内容",
    "kind：direct（单聊）或 channel（群聊），默认 direct",
    "peerHint：单聊时传好友的昵称、邮箱或 id",
    "channelId：群聊时传频道 id",
    "此工具只生成草稿，不发消息",
  ],
  returns: "草稿内容和目标信息",
  parameterSchema: {
    type: "object",
    properties: {
      text: { type: "string", description: "Draft message text." },
      kind: { type: "string", enum: ["direct", "channel"], description: "Chat kind, defaults to direct." },
      peerHint: { type: "string", description: "Friend identifier for direct chat (nickname, email, or id)." },
      channelId: { type: "string", description: "Channel id for group chat." },
    },
    required: ["text"],
    additionalProperties: false,
  },
  execute: async ({
    userId,
    text,
    kind,
    peerHint,
    channelId,
  }: {
    userId: string
    text: string
    kind?: string
    peerHint?: string
    channelId?: string
  }) => {
    const resolvedKind = (kind || "direct") as "direct" | "channel"

    if (!text?.trim()) {
      return toolForbidden("草稿内容不能为空。", "text_required")
    }

    const draftText = text.trim()

    if (resolvedKind === "channel") {
      if (!channelId?.trim()) {
        return toolForbidden("群聊草稿需要提供 channelId。", "channel_id_required")
      }

      const channel = await getChannelForUser(userId, channelId.trim())
      if (!channel) {
        return toolForbidden(
          "没有找到该群聊，或你不在该群中。",
          "channel_not_found_or_forbidden",
        )
      }

      return toolGranted(
        `已在群聊「${(channel as Record<string, unknown>).name || channelId}」中草拟回复。用户可在聊天输入框中确认后发送。`,
        {
          draft: draftText,
          kind: "channel",
          channelId: channelId.trim(),
          channelName: (channel as Record<string, unknown>).name ?? "",
          hint: "这是草稿，不会自动发送。请在 UI 中确认后发送。",
        },
      )
    }

    // Direct chat
    if (!peerHint?.trim()) {
      return toolForbidden("单聊草稿需要提供 peerHint（好友昵称、邮箱或 id）。", "peer_hint_required")
    }

    // Resolve friend
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
      return toolForbidden(
        `没有找到匹配 "${peerHint.trim()}" 的用户。请确认信息后重试。`,
        "peer_not_found",
      )
    }

    // Check friendship
    const friendship = await prisma.friendship.findFirst({
      where: {
        OR: [
          { userAId: userId, userBId: targetUser.id },
          { userAId: targetUser.id, userBId: userId },
        ],
      },
    })

    if (!friendship) {
      return toolForbidden(
        `你和 ${targetUser.displayName || targetUser.email} 还不是好友，无法起草私聊消息。`,
        "not_friends",
      )
    }

    return toolGranted(
      `已为与 ${targetUser.displayName || targetUser.email} 的对话草拟回复。用户可在聊天输入框中确认后发送。`,
      {
        draft: draftText,
        kind: "direct",
        peerId: targetUser.id,
        peerName: targetUser.displayName || targetUser.email,
        hint: "这是草稿，不会自动发送。请在 UI 中确认后发送。",
      },
    )
  },
}
