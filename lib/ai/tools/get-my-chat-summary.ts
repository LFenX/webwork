import "server-only"
import { prisma } from "@/lib/db"

export const getMyChatSummaryTool = {
  name: "get_my_chat_summary",
  title: "我的聊天摘要",
  description: "获取当前用户私聊和频道聊天的摘要统计",
  execute: async ({ userId }: { userId: string }) => {
    const [directCount, channelSentCount, unreadCount, recentDirectMessages] = await Promise.all([
      prisma.chatMessage.count({
        where: { OR: [{ senderId: userId }, { receiverId: userId }] },
      }),
      prisma.channelMessage.count({
        where: { senderId: userId },
      }),
      prisma.chatMessage.count({
        where: { receiverId: userId, readAt: null },
      }),
      prisma.chatMessage.findMany({
        where: { OR: [{ senderId: userId }, { receiverId: userId }] },
        orderBy: { createdAt: "desc" },
        take: 8,
        select: {
          id: true,
          senderId: true,
          receiverId: true,
          text: true,
          createdAt: true,
        },
      }),
    ])

    return {
      directCount,
      channelSentCount,
      unreadCount,
      recentDirectMessages: recentDirectMessages.map((item) => ({
        id: item.id,
        direction: item.senderId === userId ? "sent" : "received",
        peerId: item.senderId === userId ? item.receiverId : item.senderId,
        textPreview: item.text.slice(0, 80),
        createdAt: item.createdAt.toISOString(),
      })),
    }
  },
}
