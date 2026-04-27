import "server-only"
import { prisma } from "@/lib/db"
import { listChannelsForUser, getChannelForUser, serializeChannelMessage } from "@/lib/channel-chat"
import { toolGranted, toolForbidden } from "@/lib/ai/tools/helpers"

export const listMyChannelsTool = {
  name: "list_my_channels",
  title: "列出群聊列表",
  description:
    "列出当前用户所在的全部群聊频道及其成员信息。触发语：'我的群聊有哪些''我在哪些群里''群聊列表''列出频道'。",
  scope: "self" as const,
  inputSchemaSummary: "无需输入",
  sensitivity: "medium" as const,
  auditLabel: "list_my_channels",
  whenToUse:
    "当用户询问群聊列表、想知道有哪些群、查看群成员时使用。",
  whenNotToUse: "不要用于读取群聊消息内容（用 get_channel_messages）。",
  argumentHints: [],
  returns: "群聊列表，含 id/name/type/memberCount",
  parameterSchema: {
    type: "object",
    properties: {},
    additionalProperties: false,
  },
  execute: async ({ userId }: { userId: string }) => {
    const channels = await listChannelsForUser(userId)

    const items = channels.map((c) => ({
      id: c.id,
      type: c.type,
      name: c.name,
      announcement: c.announcement,
      memberCount: c.members.length,
      currentUserRole: c.currentUserRole,
      members: c.members.map((m) => ({
        id: m.id,
        email: m.email,
        displayName: m.displayName,
      })),
    }))

    return toolGranted(`共 ${items.length} 个群聊频道。`, { items })
  },
}

export const getChannelMessagesTool = {
  name: "get_channel_messages",
  title: "读取群聊消息",
  description:
    "读取指定群聊频道的最近消息。触发语：'群里最近聊了什么''看看 XX 群的消息''群聊记录'。",
  scope: "self" as const,
  inputSchemaSummary: "channelId: string, limit?: number",
  sensitivity: "high" as const,
  auditLabel: "read_channel_messages",
  whenToUse:
    "当用户想查看某个群聊的最近消息时使用。需要用户是该群成员。",
  whenNotToUse:
    "不要用于列出群列表（用 list_my_channels）或搜索消息（用 search_my_chat_messages）。",
  argumentHints: ["channelId 必填", "limit 默认 10，最大 30"],
  returns: "群聊最近消息列表",
  parameterSchema: {
    type: "object",
    properties: {
      channelId: { type: "string", description: "Channel id to read messages from." },
      limit: { type: "integer", minimum: 1, maximum: 30, description: "Max messages to return, defaults to 10." },
    },
    required: ["channelId"],
    additionalProperties: false,
  },
  execute: async ({
    userId,
    channelId,
    limit,
  }: {
    userId: string
    channelId: string
    limit?: number
  }) => {
    if (!channelId?.trim()) {
      return toolForbidden("channelId 不能为空。", "channel_id_required")
    }

    const channel = await getChannelForUser(userId, channelId.trim())
    if (!channel) {
      return toolForbidden(
        "没有找到该群聊，或你不在该群中。请用 list_my_channels 确认可访问的群。",
        "channel_not_found_or_forbidden",
      )
    }

    const actualLimit = Math.min(Math.max(limit ?? 10, 1), 30)

    const messages = await prisma.channelMessage.findMany({
      where: { channelId: channelId.trim() },
      orderBy: { createdAt: "desc" },
      take: actualLimit,
      include: {
        sender: {
          select: { id: true, email: true, displayName: true, avatarText: true, avatarUrl: true },
        },
      },
    })

    const items = messages.reverse().map((m) => ({
      id: m.id,
      senderId: m.senderId,
      senderName: m.sender.displayName || m.sender.email,
      text: m.text,
      stickerEmoji: m.stickerEmoji ?? null,
      createdAt: m.createdAt.toISOString(),
    }))

    return toolGranted(
      `群聊「${(channel as Record<string, unknown>).name || channelId}」最近 ${items.length} 条消息。`,
      {
        channelId: channelId.trim(),
        channelName: (channel as Record<string, unknown>).name ?? "",
        channelType: (channel as Record<string, unknown>).type ?? "group",
        items,
      },
    )
  },
}
