import "server-only"
import { prisma } from "@/lib/db"
import { resolveUserReference } from "@/lib/ai/tools/helpers"

export const getMyChatThreadMessagesTool = {
  name: "get_my_chat_thread_messages",
  title: "读取单个聊天会话",
  description: "读取当前用户与某个联系人的消息片段",
  execute: async ({
    targetUserId,
    peerHint,
    limit = 12,
  }: {
    targetUserId: string
    peerHint?: string
    limit?: number
  }) => {
    const peer = await resolveUserReference(peerHint)
    if (!peer) {
      return {
        peer: null,
        items: [],
        note: "未识别到联系人，请提供好友 id、邮箱或可唯一定位的名称。",
      }
    }

    const items = await prisma.chatMessage.findMany({
      where: {
        OR: [
          { senderId: targetUserId, receiverId: peer.id },
          { senderId: peer.id, receiverId: targetUserId },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: Math.min(Math.max(limit, 1), 30),
      select: {
        id: true,
        senderId: true,
        receiverId: true,
        text: true,
        createdAt: true,
        attachments: { select: { id: true, originalName: true } },
      },
    })

    return {
      peer: { id: peer.id, email: peer.email, displayName: peer.displayName },
      count: items.length,
      items: items.reverse().map((item) => ({
        id: item.id,
        direction: item.senderId === targetUserId ? "sent" : "received",
        text: item.text,
        createdAt: item.createdAt.toISOString(),
        attachments: item.attachments,
      })),
    }
  },
}
