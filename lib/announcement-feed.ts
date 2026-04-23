import { prisma } from "@/lib/db"

export type AnnouncementFeedItem = {
  type: "announcement" | "broadcast"
  id: string
  content: string
  createdAt: string
  author: { id: string; email: string; displayName: string }
}

export async function getAnnouncementFeed(userId: string, limit = 50): Promise<AnnouncementFeedItem[]> {
  const [announcements, broadcasts] = await Promise.all([
    prisma.announcement.findMany({
      where: {
        source: "admin",
        NOT: {
          views: {
            some: {
              userId,
              OR: [{ hidden: true }, { viewCount: { gte: 3 } }],
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { author: { select: { id: true, email: true, displayName: true } } },
    }),
    prisma.worldBroadcast.findMany({
      where: {
        NOT: {
          views: {
            some: {
              userId,
              OR: [{ hidden: true }, { viewCount: { gte: 1 } }],
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { author: { select: { id: true, email: true, displayName: true } } },
    }),
  ])

  return [
    ...announcements.map((item) => ({
      type: "announcement" as const,
      id: item.id,
      content: item.content,
      createdAt: item.createdAt.toISOString(),
      author: item.author,
    })),
    ...broadcasts.map((item) => ({
      type: "broadcast" as const,
      id: item.id,
      content: item.content,
      createdAt: item.createdAt.toISOString(),
      author: item.author,
    })),
  ]
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, limit)
}
