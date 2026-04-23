import "server-only"
import { prisma } from "@/lib/db"

export const getMyPostsOverviewTool = {
  name: "get_my_posts_overview",
  title: "我的内容概览",
  description: "获取当前用户博客、daily、reflections、notes 的概览",
  execute: async ({ userId }: { userId: string }) => {
    const [posts, counts] = await Promise.all([
      prisma.post.findMany({
        where: { userId },
        orderBy: { date: "desc" },
        take: 12,
        select: {
          id: true,
          type: true,
          title: true,
          slug: true,
          summary: true,
          visibility: true,
          date: true,
        },
      }),
      prisma.post.groupBy({
        by: ["type"],
        where: { userId },
        _count: { _all: true },
      }),
    ])

    return {
      countsByType: counts.reduce<Record<string, number>>((acc, item) => {
        acc[item.type] = item._count._all
        return acc
      }, {}),
      recentPosts: posts.map((post) => ({
        ...post,
        date: post.date.toISOString(),
      })),
    }
  },
}
