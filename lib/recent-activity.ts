import "server-only"
import { prisma } from "@/lib/db"
import { getReadRecentActivityIds } from "@/lib/recent-activity-reads"

export type RecentActivityTone = "blue" | "green" | "amber" | "coral"

export type RecentActivityItem = {
  id: string
  title: string
  description: string
  href: string
  meta: string
  time: string
  badge: string
  tone: RecentActivityTone
  channelId?: string
  channelTotalCount?: number
  variant?: "default" | "sticker-bundle"
  stickers?: Array<{
    id: string
    name: string
    url: string
    isAnimated: boolean
  }>
}

export type RecentActivityGroup = {
  key: string
  title: string
  subtitle: string
  href: string
  icon: "chat" | "friends" | "community" | "roundtable"
  pulse: string
  items: RecentActivityItem[]
}

const ARTICLE_ACTIVITY_LABELS: Record<string, string> = {
  blog: "博客",
  reflections: "心得",
  notes: "笔记",
  daily: "日常",
}

function compactText(value: string | null | undefined, fallback: string, max = 54) {
  const text = (value ?? "").replace(/\s+/g, " ").trim() || fallback
  return text.length > max ? `${text.slice(0, max - 1)}...` : text
}

function normalizeFriendName(user?: { displayName: string; email: string } | null) {
  return user?.displayName || user?.email?.split("@")[0] || "好友"
}

async function getFriendIds(userId: string) {
  const friendships = await prisma.friendship.findMany({
    where: { OR: [{ userAId: userId }, { userBId: userId }] },
    select: { userAId: true, userBId: true },
  })
  return friendships.map((friendship) => (friendship.userAId === userId ? friendship.userBId : friendship.userAId))
}

export async function getRecentActivityHub(userId: string): Promise<RecentActivityGroup[]> {
  const friendIds = await getFriendIds(userId)
  const moduleRows = friendIds.length > 0
    ? await prisma.moduleVisibility.findMany({
        where: {
          userId: { in: friendIds },
          visibility: "friends",
          module: { in: ["blog", "daily", "reflections", "notes", "jobs", "resume"] },
        },
        select: { userId: true, module: true },
      })
    : []

  const allowedByModule = moduleRows.reduce<Record<string, string[]>>((data, row) => {
    data[row.module] = [...(data[row.module] ?? []), row.userId]
    return data
  }, {})
  const articleFilters = (["blog", "daily", "reflections", "notes"] as const)
    .map((type) => {
      const ids = allowedByModule[type] ?? []
      return ids.length > 0 ? { type, userId: { in: ids }, visibility: { in: ["friends", "public"] } } : null
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))

  const [directUnreadGroups, directLatestMessages, channelSummaries, friendPosts, friendJobs, friendResumes, websites, stickers, roundtables] = await Promise.all([
    prisma.chatMessage.groupBy({
      by: ["senderId"],
      where: { receiverId: userId, senderId: { in: friendIds }, readAt: null },
      _count: { _all: true },
      _max: { createdAt: true },
    }),
    Promise.all(friendIds.map(async (friendId) => {
      const latest = await prisma.chatMessage.findFirst({
        where: { senderId: friendId, receiverId: userId, readAt: null },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        include: {
          sender: { select: { id: true, displayName: true, email: true } },
          attachments: { select: { id: true }, take: 1 },
        },
      })
      return [friendId, latest] as const
    })),
    prisma.chatChannel.findMany({
      where: { members: { some: { userId } } },
      include: {
        _count: { select: { messages: true } },
        messages: {
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: 1,
          include: {
            sender: { select: { id: true, displayName: true, email: true } },
            attachments: { select: { id: true }, take: 1 },
          },
        },
      },
    }),
    articleFilters.length > 0
      ? prisma.post.findMany({
          where: { OR: articleFilters },
          orderBy: [{ updatedAt: "desc" }, { date: "desc" }],
          take: 50,
          include: { user: { select: { id: true, displayName: true, email: true } } },
        })
      : Promise.resolve([]),
    (allowedByModule.jobs ?? []).length > 0
      ? prisma.jobApplication.findMany({
          where: { userId: { in: allowedByModule.jobs } },
          orderBy: { updatedAt: "desc" },
          take: 50,
          include: { user: { select: { id: true, displayName: true, email: true } } },
        })
      : Promise.resolve([]),
    (allowedByModule.resume ?? []).length > 0
      ? prisma.resume.findMany({
          where: { userId: { in: allowedByModule.resume } },
          orderBy: { updatedAt: "desc" },
          take: 50,
          include: { user: { select: { id: true, displayName: true, email: true } } },
        })
      : Promise.resolve([]),
    prisma.websiteResource.findMany({
      where: { visibility: "public" },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { user: { select: { displayName: true, email: true } } },
    }),
    prisma.stickerAsset.findMany({
      where: { scope: "public", ownerId: { not: null } },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        owner: { select: { id: true, displayName: true, email: true } },
        uploader: { select: { id: true, displayName: true, email: true } },
      },
    }),
    prisma.soulWingRoundtableDiscussion.findMany({
      where: { deletedAt: null },
      orderBy: [{ lastMessageAt: "desc" }, { createdAt: "desc" }],
      take: 50,
      include: {
        messages: {
          where: { deletedAt: null },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { authorName: true, text: true, createdAt: true },
        },
      },
    }),
  ])

  const latestUnreadByFriend = new Map(directLatestMessages)
  const unreadByFriend = new Map(directUnreadGroups.map((group) => [group.senderId, group._count._all]))
  const chatItems = [
    ...friendIds.flatMap((friendId): RecentActivityItem[] => {
      const latest = latestUnreadByFriend.get(friendId)
      const unreadCount = unreadByFriend.get(friendId) ?? 0
      if (!latest || unreadCount <= 0) return []
      return [{
        id: `direct-${friendId}-${latest.id}`,
        title: `${normalizeFriendName(latest.sender)}的私聊`,
        description: compactText(latest.text, latest.stickerEmoji ? `发来表情 ${latest.stickerEmoji}` : latest.attachments.length > 0 ? "发送了新的附件" : "有新的好友消息"),
        href: `/friends?type=direct&id=${encodeURIComponent(friendId)}`,
        meta: "好友新消息",
        time: latest.createdAt.toISOString(),
        badge: `${unreadCount} 条新消息`,
        tone: "blue",
      }]
    }),
    ...channelSummaries.flatMap((channel): RecentActivityItem[] => {
      const latest = channel.messages[0]
      if (!latest || channel.id === "soulwing-roundtable") return []
      return [{
        id: `channel-${channel.id}-${channel._count.messages}`,
        title: channel.name,
        description: `${normalizeFriendName(latest.sender)}：${compactText(latest.text, latest.stickerEmoji ? `发了表情 ${latest.stickerEmoji}` : latest.attachments.length > 0 ? "分享了附件" : "群里有新讨论")}`,
        href: `/friends?type=channel&id=${encodeURIComponent(channel.id)}`,
        meta: "群聊动态",
        time: latest.createdAt.toISOString(),
        badge: "群聊",
        tone: "green",
        channelId: channel.id,
        channelTotalCount: channel._count.messages,
      }]
    }),
  ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())

  const friendItems = [
    ...friendPosts.map((post): RecentActivityItem => ({
      id: `post-${post.id}-${post.updatedAt.getTime()}`,
      title: `${normalizeFriendName(post.user)}发布了${ARTICLE_ACTIVITY_LABELS[post.type] ?? "内容"}`,
      description: compactText(post.title, "新的文章动态"),
      href: `/u/${post.userId}/${post.type}/${encodeURIComponent(post.slug)}`,
      meta: compactText(post.summary, ARTICLE_ACTIVITY_LABELS[post.type] ?? "文章", 34),
      time: post.updatedAt.toISOString(),
      badge: ARTICLE_ACTIVITY_LABELS[post.type] ?? "文章",
      tone: "blue",
    })),
    ...friendJobs.map((job): RecentActivityItem => ({
      id: `job-${job.id}-${job.updatedAt.getTime()}`,
      title: `${normalizeFriendName(job.user)}更新了求职进展`,
      description: `${job.company} · ${job.position}`,
      href: `/u/${job.userId}/jobs`,
      meta: job.status,
      time: job.updatedAt.toISOString(),
      badge: "求职",
      tone: "amber",
    })),
    ...friendResumes.map((resume): RecentActivityItem => ({
      id: `resume-${resume.userId}-${resume.updatedAt.getTime()}`,
      title: `${normalizeFriendName(resume.user)}更新了简历`,
      description: resume.selectedTheme ? `当前模板：${resume.selectedTheme}` : "简历内容有新的调整",
      href: `/u/${resume.userId}/resume`,
      meta: resume.mode === "json" ? "结构化简历" : "Markdown 简历",
      time: resume.updatedAt.toISOString(),
      badge: "简历",
      tone: "coral",
    })),
  ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())

  const stickerBundles = Array.from(stickers
    .filter((sticker) => sticker.isAnimated)
    .reduce<Map<string, typeof stickers>>((groups, sticker) => {
      const contributor = sticker.owner ?? sticker.uploader
      const key = contributor?.id ?? "unknown"
      groups.set(key, [...(groups.get(key) ?? []), sticker])
      return groups
    }, new Map())
    .values())

  const communityItems = [
    ...websites.map((site): RecentActivityItem => ({
      id: `website-${site.id}`,
      title: site.name,
      description: compactText(site.description, site.domain || site.url),
      href: `/community/resources/websites?focus=${encodeURIComponent(site.id)}`,
      meta: `${normalizeFriendName(site.user)}分享`,
      time: site.createdAt.toISOString(),
      badge: "网站",
      tone: "green",
    })),
    ...stickerBundles.map((bundle): RecentActivityItem => {
      const latest = bundle[0]
      const contributor = latest.owner ?? latest.uploader
      return {
      id: `sticker-bundle-${contributor?.id ?? "unknown"}-${bundle.map((sticker) => sticker.id).join("-")}`,
      title: `${normalizeFriendName(contributor)}上传了 ${bundle.length} 个 GIF 表情`,
      description: bundle.map((sticker) => sticker.name || sticker.originalName).slice(0, 5).join("、"),
      href: "/stickers/community",
      meta: "动图表情合集",
      time: latest.createdAt.toISOString(),
      badge: `${bundle.length} 个 GIF`,
      tone: "amber",
      variant: "sticker-bundle",
      stickers: bundle.map((sticker) => ({
        id: sticker.id,
        name: sticker.name || sticker.originalName,
        url: `/api/stickers/${sticker.id}/file`,
        isAnimated: sticker.isAnimated,
      })),
    }}),
  ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())

  const roundtableItems = roundtables.map((discussion): RecentActivityItem => {
    const latest = discussion.messages[0]
    const activityTime = discussion.lastMessageAt ?? discussion.startedAt ?? discussion.scheduledAt ?? discussion.createdAt
    return {
      id: `roundtable-${discussion.id}-${activityTime.getTime()}`,
      title: discussion.topicTitle,
      description: latest ? `${latest.authorName}：${compactText(latest.text, "圆桌正在继续")}` : compactText(discussion.topicDescription, "新的圆桌议题已准备好"),
      href: `/friends?type=channel&id=soulwing-roundtable&discussion=${encodeURIComponent(discussion.id)}`,
      meta: discussion.status === "running" ? "正在讨论" : discussion.status === "completed" ? "可追问" : "待开始",
      time: activityTime.toISOString(),
      badge: discussion.slot === "morning" ? "晨间" : discussion.slot === "evening" ? "夜间" : "圆桌",
      tone: discussion.status === "running" ? "coral" : "blue",
    }
  })

  const groups: RecentActivityGroup[] = [
    { key: "chat", title: "聊天动态", subtitle: "按会话聚合未读消息", href: "/friends?type=channel&id=world", icon: "chat", pulse: "bg-[#2563eb]", items: chatItems },
    { key: "friends", title: "好友动态", subtitle: "文章、求职、简历更新", href: "/friends", icon: "friends", pulse: "bg-[#c96442]", items: friendItems },
    { key: "community", title: "社区动态", subtitle: "新网站与新表情包", href: "/community/resources", icon: "community", pulse: "bg-[#3a7d5c]", items: communityItems },
    { key: "roundtable", title: "蝶灵圆桌", subtitle: "从频道进入具体议题", href: "/friends?type=channel&id=soulwing-roundtable", icon: "roundtable", pulse: "bg-[#b8902d]", items: roundtableItems },
  ]
  const readIds = await getReadRecentActivityIds(userId, groups.flatMap((group) => group.key === "chat" ? [] : group.items.map((item) => item.id)))
  return groups.map((group) => group.key === "chat" ? group : { ...group, items: group.items.filter((item) => !readIds.has(item.id)) })
}
