import "server-only"
import { prisma } from "@/lib/db"
import { previewText } from "@/lib/ai/tools/helpers"

export const getMyChatThreadsOverviewTool = {
  name: "get_my_chat_threads_overview",
  title: "我的聊天会话概览",
  description: "获取当前用户私聊对象排行、最近会话、未读数和最近消息时间",
  execute: async ({ targetUserId }: { targetUserId: string }) => {
    const [friendships, messages, unreadGroups] = await Promise.all([
      prisma.friendship.findMany({
        where: { OR: [{ userAId: targetUserId }, { userBId: targetUserId }] },
        include: {
          userA: { select: { id: true, email: true, displayName: true } },
          userB: { select: { id: true, email: true, displayName: true } },
        },
      }),
      prisma.chatMessage.findMany({
        where: { OR: [{ senderId: targetUserId }, { receiverId: targetUserId }] },
        orderBy: { createdAt: "desc" },
        take: 300,
        select: {
          id: true,
          senderId: true,
          receiverId: true,
          text: true,
          createdAt: true,
          attachments: { select: { id: true } },
        },
      }),
      prisma.chatMessage.groupBy({
        by: ["senderId"],
        where: { receiverId: targetUserId, readAt: null },
        _count: { _all: true },
      }),
    ])

    const friendMap = new Map(
      friendships.map((friendship) => {
        const friend = friendship.userAId === targetUserId ? friendship.userB : friendship.userA
        return [
          friend.id,
          {
            id: friend.id,
            email: friend.email,
            displayName: friend.displayName,
            friendedAt: friendship.createdAt.toISOString(),
          },
        ] as const
      })
    )

    const unreadMap = new Map(unreadGroups.map((item) => [item.senderId, item._count._all]))
    const threadStats = new Map<string, {
      peerId: string
      messageCount: number
      latestAt: string
      latestPreview: string
      hasAttachment: boolean
    }>()

    for (const item of messages) {
      const peerId = item.senderId === targetUserId ? item.receiverId : item.senderId
      const existing = threadStats.get(peerId)
      if (!existing) {
        threadStats.set(peerId, {
          peerId,
          messageCount: 1,
          latestAt: item.createdAt.toISOString(),
          latestPreview: previewText(item.text || (item.attachments.length > 0 ? "[附件]" : "")),
          hasAttachment: item.attachments.length > 0,
        })
      } else {
        existing.messageCount += 1
      }
    }

    return {
      totalThreads: threadStats.size,
      threads: Array.from(threadStats.values())
        .sort((a, b) => {
          if (a.messageCount !== b.messageCount) return b.messageCount - a.messageCount
          return a.latestAt < b.latestAt ? 1 : -1
        })
        .slice(0, 20)
        .map((thread) => ({
          ...thread,
          unreadCount: unreadMap.get(thread.peerId) ?? 0,
          peer: friendMap.get(thread.peerId) ?? null,
        })),
    }
  },
}
