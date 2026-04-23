import "server-only"
import { prisma } from "@/lib/db"

export const getMyFriendsOverviewTool = {
  name: "get_my_friends_overview",
  title: "我的好友概览",
  description: "获取当前用户的好友数量和最近关系概览",
  execute: async ({ userId }: { userId: string }) => {
    const friendships = await prisma.friendship.findMany({
      where: { OR: [{ userAId: userId }, { userBId: userId }] },
      orderBy: { createdAt: "desc" },
      take: 12,
      include: {
        userA: { select: { id: true, email: true, displayName: true } },
        userB: { select: { id: true, email: true, displayName: true } },
      },
    })

    return {
      total: await prisma.friendship.count({
        where: { OR: [{ userAId: userId }, { userBId: userId }] },
      }),
      recentFriends: friendships.map((friendship) => {
        const friend = friendship.userAId === userId ? friendship.userB : friendship.userA
        return {
          id: friend.id,
          email: friend.email,
          displayName: friend.displayName,
          createdAt: friendship.createdAt.toISOString(),
        }
      }),
    }
  },
}
