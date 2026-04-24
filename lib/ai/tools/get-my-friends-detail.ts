import "server-only"
import { prisma } from "@/lib/db"

export const getMyFriendsDetailTool = {
  name: "get_my_friends_detail",
  title: "我的好友明细",
  description: "获取当前用户好友列表、关系建立时间与最近互动",
  execute: async ({ targetUserId }: { targetUserId: string }) => {
    const friendships = await prisma.friendship.findMany({
      where: { OR: [{ userAId: targetUserId }, { userBId: targetUserId }] },
      orderBy: { createdAt: "desc" },
      include: {
        userA: { select: { id: true, email: true, displayName: true } },
        userB: { select: { id: true, email: true, displayName: true } },
      },
    })

    const friendIds = friendships.map((item) => item.userAId === targetUserId ? item.userBId : item.userAId)
    const latestMessages = friendIds.length === 0 ? [] : await prisma.chatMessage.findMany({
      where: {
        OR: friendIds.flatMap((friendId) => [
          { senderId: targetUserId, receiverId: friendId },
          { senderId: friendId, receiverId: targetUserId },
        ]),
      },
      orderBy: { createdAt: "desc" },
      take: Math.max(friendIds.length * 2, 20),
      select: {
        senderId: true,
        receiverId: true,
        createdAt: true,
      },
    })

    const latestMap = new Map<string, string>()
    for (const item of latestMessages) {
      const friendId = item.senderId === targetUserId ? item.receiverId : item.senderId
      if (!latestMap.has(friendId)) {
        latestMap.set(friendId, item.createdAt.toISOString())
      }
    }

    return {
      total: friendships.length,
      items: friendships.map((friendship) => {
        const friend = friendship.userAId === targetUserId ? friendship.userB : friendship.userA
        return {
          id: friend.id,
          email: friend.email,
          displayName: friend.displayName,
          friendedAt: friendship.createdAt.toISOString(),
          lastInteractionAt: latestMap.get(friend.id) ?? null,
        }
      }),
    }
  },
}
