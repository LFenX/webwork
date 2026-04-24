import "server-only"
import { prisma } from "@/lib/db"
import { previewText, resolveUserReference } from "@/lib/ai/tools/helpers"

export const searchMyChatMessagesTool = {
  name: "search_my_chat_messages",
  title: "搜索我的聊天记录",
  description: "按关键词、联系人和时间范围搜索当前用户自己的私聊消息",
  execute: async ({
    targetUserId,
    query,
    peerHint,
    limit = 10,
  }: {
    targetUserId: string
    query?: string
    peerHint?: string
    limit?: number
  }) => {
    const peer = await resolveUserReference(peerHint)
    const items = await prisma.chatMessage.findMany({
      where: {
        OR: [{ senderId: targetUserId }, { receiverId: targetUserId }],
        ...(query?.trim() ? { text: { contains: query.trim(), mode: "insensitive" } } : {}),
        ...(peer ? {
          OR: [
            { senderId: targetUserId, receiverId: peer.id },
            { senderId: peer.id, receiverId: targetUserId },
          ],
        } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: Math.min(Math.max(limit, 1), 20),
      select: {
        id: true,
        senderId: true,
        receiverId: true,
        text: true,
        createdAt: true,
      },
    })

    return {
      query: query ?? "",
      peer: peer ? { id: peer.id, email: peer.email, displayName: peer.displayName } : null,
      count: items.length,
      items: items.map((item) => ({
        id: item.id,
        direction: item.senderId === targetUserId ? "sent" : "received",
        peerId: item.senderId === targetUserId ? item.receiverId : item.senderId,
        textPreview: previewText(item.text, 120),
        createdAt: item.createdAt.toISOString(),
      })),
    }
  },
}
