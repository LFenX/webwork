import { BarChart3, BookOpen, BriefcaseBusiness, CalendarDays, Edit3, FileText, MessageCircle, PenLine, Share2, Sparkles, UsersRound } from "lucide-react"
import { prisma } from "@/lib/db"
import { getPosts } from "@/lib/mdx"
import { getOptionalSession } from "@/lib/auth"
import { LandingPage } from "@/components/landing/landing-page"
import { getLandingPlatformStats } from "@/lib/landing-stats"
import { GuestbookSection } from "@/components/guestbook-section"
import { formatDateKey } from "@/lib/time"
import { countWords } from "@/lib/text-stats"
import { RecentActivityPanel, type RecentActivityGroup, type RecentActivityItem } from "@/components/recent-activity-panel"
import { getReadRecentActivityIds } from "@/lib/recent-activity-reads"
import { hasJobReplySignal } from "@/lib/job-stats"
import { publicProfileHref } from "@/lib/public-profile"
import {
  ChatActivityCard,
  type ChatParticipant,
  CompactHeatmapCard,
  CompactListPanel,
  ContentListPanel,
  JobFunnelCard,
  PersonalHeroCard,
  PersonalHomeGrid,
  PersonalHomeShell,
  VisitOverviewCard,
  WritingStatsCard,
  type VisitDetailItem,
  type PersonalContentItem,
  type PersonalMetric,
} from "@/components/profile/personal-home"

export const dynamic = "force-dynamic"
export const fetchCache = "force-no-store"

const ARTICLE_TYPES = ["blog", "reflections", "notes"] as const

function isInterviewStatus(status: string) {
  return status.includes("面试") || status.includes("Offer") || status.includes("待定")
}

function isOfferStatus(status: string) {
  return status.includes("Offer")
}

async function getJobStats(userId: string) {
  const jobs = await prisma.jobApplication.findMany({ where: { userId } })
  const total = jobs.length
  const replied = jobs.filter(hasJobReplySignal).length
  const hasInterview = jobs.filter((job) => isInterviewStatus(job.status)).length
  const offers = jobs.filter((job) => isOfferStatus(job.status)).length
  return {
    total,
    replied,
    replyRate: total > 0 ? Math.round((replied / total) * 100) : 0,
    hasInterview,
    offers,
  }
}

async function getRecentJobs(userId: string) {
  return prisma.jobApplication.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    take: 200,
  })
}

async function getArticleActivityData(userId: string) {
  const posts = await prisma.post.findMany({
    where: { userId, type: { in: [...ARTICLE_TYPES, "daily"] } },
    select: { date: true },
    orderBy: { date: "desc" },
    take: 1000,
  })
  return posts.reduce<Record<string, number>>((data, post) => {
    const key = formatDateKey(post.date)
    data[key] = (data[key] ?? 0) + 1
    return data
  }, {})
}

async function getJobActivityData(userId: string) {
  const jobs = await prisma.jobApplication.findMany({
    where: { userId },
    select: { appliedAt: true },
    orderBy: { appliedAt: "desc" },
    take: 1000,
  })
  return jobs.reduce<Record<string, number>>((data, job) => {
    const key = formatDateKey(job.appliedAt)
    data[key] = (data[key] ?? 0) + 1
    return data
  }, {})
}

async function getChatActivityData(userId: string) {
  const [directSent, directReceived, channelMessages, recentDirectMessages, friendships] = await Promise.all([
    prisma.chatMessage.findMany({ where: { senderId: userId }, select: { createdAt: true }, take: 1000, orderBy: { createdAt: "desc" } }),
    prisma.chatMessage.findMany({ where: { receiverId: userId }, select: { createdAt: true }, take: 1000, orderBy: { createdAt: "desc" } }),
    prisma.channelMessage.findMany({ where: { senderId: userId }, select: { createdAt: true }, take: 1000, orderBy: { createdAt: "desc" } }),
    prisma.chatMessage.findMany({
      where: { OR: [{ senderId: userId }, { receiverId: userId }] },
      orderBy: { createdAt: "desc" },
      take: 40,
      include: {
        sender: { select: { id: true, displayName: true, email: true, avatarText: true, avatarUrl: true } },
        receiver: { select: { id: true, displayName: true, email: true, avatarText: true, avatarUrl: true } },
      },
    }),
    prisma.friendship.findMany({
      where: { OR: [{ userAId: userId }, { userBId: userId }] },
      orderBy: { createdAt: "desc" },
      take: 12,
      include: {
        userA: { select: { id: true, displayName: true, email: true, avatarText: true, avatarUrl: true } },
        userB: { select: { id: true, displayName: true, email: true, avatarText: true, avatarUrl: true } },
      },
    }),
  ])
  const participantsMap = new Map<string, ChatParticipant>()
  recentDirectMessages.forEach((message) => {
    const participant = message.senderId === userId ? message.receiver : message.sender
    if (!participantsMap.has(participant.id)) participantsMap.set(participant.id, participant)
  })
  friendships.forEach((friendship) => {
    const participant = friendship.userAId === userId ? friendship.userB : friendship.userA
    if (!participantsMap.has(participant.id)) participantsMap.set(participant.id, participant)
  })
  const heatmap = [...directSent, ...directReceived, ...channelMessages].reduce<Record<string, number>>((data, message) => {
    const key = formatDateKey(message.createdAt)
    data[key] = (data[key] ?? 0) + 1
    return data
  }, {})
  const nowTime = Date.now()
  const weeklyActive = Object.entries(heatmap)
    .filter(([key]) => nowTime - new Date(key).getTime() < 7 * 86400000)
    .reduce((sum, [, value]) => sum + value, 0)
  return {
    directCount: directSent.length + directReceived.length,
    channelCount: channelMessages.length,
    weeklyActive,
    heatmap,
    participants: Array.from(participantsMap.values()).slice(0, 6),
  }
}

async function getWritingStats(userId: string) {
  const posts = await prisma.post.findMany({
    where: { userId, type: { in: [...ARTICLE_TYPES, "daily"] } },
    select: { content: true, date: true, tags: true },
  })
  const totalWords = posts.reduce((sum, post) => sum + countWords(post.content), 0)
  const tagCount: Record<string, number> = {}
  posts.forEach((post) => {
    const tags = JSON.parse(post.tags || "[]") as string[]
    tags.forEach((tag) => {
      tagCount[tag] = (tagCount[tag] ?? 0) + 1
    })
  })
  const topTags = Object.entries(tagCount)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 12)
    .map(([tag, count]) => ({ tag, count }))

  const today = formatDateKey(new Date())
  const dates = new Set(posts.map((post) => formatDateKey(post.date)))
  let streak = 0
  const cursor = new Date()
  while (dates.has(formatDateKey(cursor))) {
    streak++
    cursor.setDate(cursor.getDate() - 1)
  }

  const thisMonth = posts.filter((post) => formatDateKey(post.date).slice(0, 7) === today.slice(0, 7)).length
  return { totalWords, topTags, streak, thisMonth, total: posts.length }
}

async function getProfile(userId: string) {
  const rows = await prisma.$queryRaw<Array<{ id: string; displayName: string; email: string; publicSlug: string | null; bio: string; avatarText: string; avatarUrl: string | null; location: string }>>`
    SELECT id, "displayName", email, "publicSlug", bio, "avatarText", "avatarUrl", location
    FROM "User"
    WHERE id = ${userId}
    LIMIT 1
  `
  return rows[0] ?? null
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

async function getRecentActivityHub(userId: string): Promise<RecentActivityGroup[]> {
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
          include: { user: { select: { id: true, displayName: true, email: true, publicSlug: true } } },
        })
      : Promise.resolve([]),
    (allowedByModule.jobs ?? []).length > 0
      ? prisma.jobApplication.findMany({
          where: { userId: { in: allowedByModule.jobs } },
          orderBy: { updatedAt: "desc" },
          take: 50,
          include: { user: { select: { id: true, displayName: true, email: true, publicSlug: true } } },
        })
      : Promise.resolve([]),
    (allowedByModule.resume ?? []).length > 0
      ? prisma.resume.findMany({
          where: { userId: { in: allowedByModule.resume } },
          orderBy: { updatedAt: "desc" },
          take: 50,
          include: { user: { select: { id: true, displayName: true, email: true, publicSlug: true } } },
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
      href: publicProfileHref(post.user, `${post.type}/${encodeURIComponent(post.slug)}`),
      meta: compactText(post.summary, ARTICLE_ACTIVITY_LABELS[post.type] ?? "文章", 34),
      time: post.updatedAt.toISOString(),
      badge: ARTICLE_ACTIVITY_LABELS[post.type] ?? "文章",
      tone: "blue",
    })),
    ...friendJobs.map((job): RecentActivityItem => ({
      id: `job-${job.id}-${job.updatedAt.getTime()}`,
      title: `${normalizeFriendName(job.user)}更新了求职进展`,
      description: `${job.company} · ${job.position}`,
      href: publicProfileHref(job.user, "jobs"),
      meta: job.status,
      time: job.updatedAt.toISOString(),
      badge: "求职",
      tone: "amber",
    })),
    ...friendResumes.map((resume): RecentActivityItem => ({
      id: `resume-${resume.userId}-${resume.updatedAt.getTime()}`,
      title: `${normalizeFriendName(resume.user)}更新了简历`,
      description: resume.selectedTheme ? `当前模板：${resume.selectedTheme}` : "简历内容有新的调整",
      href: publicProfileHref(resume.user, "resume"),
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

async function getVisitDashboardData(userId: string) {
  const since = new Date()
  since.setDate(since.getDate() - 29)
  since.setHours(0, 0, 0, 0)

  const [total, recent, uniqueVisitors, recentVisitors] = await Promise.all([
    prisma.visitLog.count({ where: { ownerId: userId, module: "home" } }),
    prisma.visitLog.findMany({
      where: { ownerId: userId, createdAt: { gte: since } },
      select: { createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.visitLog.groupBy({
      by: ["visitorId"],
      where: { ownerId: userId, visitorId: { not: null } },
      _count: { _all: true },
    }),
    prisma.visitLog.findMany({
      where: { ownerId: userId, createdAt: { gte: since } },
      select: {
        id: true,
        module: true,
        path: true,
        createdAt: true,
        visitor: { select: { displayName: true, email: true, avatarText: true, avatarUrl: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ])

  const daily = recent.reduce<Record<string, number>>((data, item) => {
    const key = formatDateKey(item.createdAt)
    data[key] = (data[key] ?? 0) + 1
    return data
  }, {})
  const trend = Array.from({ length: 30 }, (_, index) => {
    const day = new Date(since)
    day.setDate(since.getDate() + index)
    return daily[formatDateKey(day)] ?? 0
  })

  return {
    total,
    last30: recent.length,
    uniqueVisitors: uniqueVisitors.length,
    trend,
    recentVisitors: recentVisitors.map((visit): VisitDetailItem => ({
      id: visit.id,
      visitorName: visit.visitor?.displayName || visit.visitor?.email || "匿名访客",
      visitorEmail: visit.visitor?.email,
      visitorAvatarText: visit.visitor?.avatarText,
      visitorAvatarUrl: visit.visitor?.avatarUrl,
      module: visit.module,
      path: visit.path,
      createdAt: visit.createdAt.toISOString(),
    })),
  }
}

export default async function HomePage() {
  const session = await getOptionalSession()
  if (!session) {
    const platform = await getLandingPlatformStats()
    return <LandingPage platform={platform} />
  }
  const { userId } = session

  const [
    stats,
    recentJobs,
    articleActivityData,
    jobActivityData,
    chatActivity,
    writingStats,
    profile,
    guestbookMessages,
    articleGroups,
    recentDaily,
    recentActivity,
    visitDashboard,
  ] = await Promise.all([
    getJobStats(userId),
    getRecentJobs(userId),
    getArticleActivityData(userId),
    getJobActivityData(userId),
    getChatActivityData(userId),
    getWritingStats(userId),
    getProfile(userId),
    prisma.guestbookMessage.findMany({
      where: { ownerId: userId },
      orderBy: { createdAt: "desc" },
      include: {
        author: { select: { id: true, displayName: true, email: true, avatarText: true, avatarUrl: true } },
        sticker: { select: { id: true, name: true, originalName: true, isAnimated: true } },
      },
    }).then((messages) =>
      messages.map((message) => ({
        id: message.id,
        content: message.content,
        parentId: message.parentId,
        stickerId: message.stickerId,
        stickerEmoji: message.stickerEmoji,
        ipAddress: message.ipAddress,
        geoLocation: message.geoLocation,
        sticker: message.sticker ? { ...message.sticker, url: `/api/stickers/${message.sticker.id}/file` } : null,
        createdAt: message.createdAt.toISOString(),
        author: message.author,
      }))
    ),
    Promise.all(ARTICLE_TYPES.map(async (type) => (await getPosts(type, userId)).map((post) => ({ ...post, typeLabel: ARTICLE_ACTIVITY_LABELS[type] })))),
    getPosts("daily", userId),
    getRecentActivityHub(userId),
    getVisitDashboardData(userId),
  ])

  const displayName = profile?.displayName || profile?.email || session.email
  const email = profile?.email || session.email
  const allPostsFull = articleGroups.flat().sort((a, b) => (a.date < b.date ? 1 : -1))
  const latestArticles = allPostsFull.slice(0, 5)
  const latestDaily = recentDaily.slice(0, 5)

  const latestArticleItems: PersonalContentItem[] = latestArticles.map((post) => ({
    key: `${post.type}-${post.slug}`,
    title: post.title,
    href: `/${post.type}/${encodeURIComponent(post.slug)}`,
    date: post.date,
    summary: post.summary,
    label: post.typeLabel,
    tags: post.tags,
  }))
  const latestDailyItems: PersonalContentItem[] = latestDaily.map((post) => ({
    key: post.slug,
    title: post.title,
    href: `/daily/${encodeURIComponent(post.slug)}`,
    date: post.date,
    summary: post.summary,
    tags: post.tags,
  }))
  const recentJobItems: PersonalContentItem[] = recentJobs.slice(0, 5).map((job) => ({
    key: job.id,
    title: `${job.company} · ${job.position}`,
    href: "/jobs",
    date: job.appliedAt.toISOString().slice(0, 10),
    summary: job.notes || job.baseLocation || "求职进展已更新",
    meta: job.status,
  }))

  const coreMetrics: PersonalMetric[] = [
    { label: "文章", value: allPostsFull.length, unit: "篇", sub: "持续沉淀", icon: FileText, tone: "blue" },
    { label: "日常", value: recentDaily.length, unit: "条", sub: "轻量记录", icon: CalendarDays, tone: "blue" },
    { label: "求职", value: stats.total, unit: "项", sub: `回复率 ${stats.replyRate}%`, icon: BriefcaseBusiness, tone: "orange" },
    { label: "访客", value: visitDashboard.total, unit: "次", sub: `近 30 天 ${visitDashboard.last30}`, icon: UsersRound, tone: "green" },
    { label: "互动", value: chatActivity.directCount + chatActivity.channelCount, unit: "次", sub: `本周 ${chatActivity.weeklyActive}`, icon: MessageCircle, tone: "green" },
    { label: "留言", value: guestbookMessages.length, unit: "条", sub: "欢迎交流", icon: MessageCircle, tone: "blue" },
  ]

  const funnelSteps = [
    { label: "投递", value: stats.total, color: "#6d9df8" },
    { label: "回复", value: stats.replied, color: "#69c08b" },
    { label: "面试", value: stats.hasInterview, color: "#f5a343" },
    { label: "Offer", value: stats.offers, color: "#ef6b73" },
  ]
  const offerConversion = stats.total > 0 ? Math.round((stats.offers / stats.total) * 100) : 0

  return (
    <PersonalHomeShell>
      <PersonalHomeGrid
        main={
          <>
            <PersonalHeroCard
              name={displayName}
              email={email}
              bio={profile?.bio}
              location={profile?.location}
              avatarText={profile?.avatarText}
              avatarUrl={profile?.avatarUrl}
              metrics={coreMetrics}
              actions={[
                { label: "编辑资料", href: "/settings/profile", icon: Edit3, variant: "primary" },
                {
                  label: "分享主页",
                  href: publicProfileHref({ id: userId, publicSlug: profile?.publicSlug }),
                  copyHref: publicProfileHref({ id: userId, publicSlug: profile?.publicSlug }),
                  icon: Share2,
                  variant: "ghost",
                },
                { label: "写文章", href: "/blog/new", icon: PenLine, variant: "primary" },
                { label: "蝶灵", href: "/ai", icon: Sparkles, variant: "secondary" },
                { label: "好友", href: "/friends", icon: UsersRound, variant: "ghost" },
                { label: "分析", href: "/sql", icon: BarChart3, variant: "ghost" },
              ]}
            />

            <ContentListPanel
              title="最新文章"
              icon={BookOpen}
              href="/blog"
              items={latestArticleItems}
              emptyTitle="还没有发布文章"
              emptyDescription="写下第一篇文章后，这里会成为你的内容入口。"
              featureFirst
            />

            <CompactListPanel
              title="最近日常"
              icon={CalendarDays}
              href="/daily"
              items={latestDailyItems}
              emptyTitle="暂无日常记录"
              emptyDescription="生活片段会在这里形成清爽的时间流。"
              tone="green"
            />

            <RecentActivityPanel groups={recentActivity} userId={userId} variant="list" />

            <CompactListPanel
              title="最近求职动态"
              icon={BriefcaseBusiness}
              href="/jobs"
              items={recentJobItems}
              emptyTitle="暂无求职动态"
              emptyDescription="开始记录投递后，这里会显示最近的公司和状态变化。"
              tone="orange"
            />

            <div id="guestbook" className="scroll-mt-20">
              <GuestbookSection ownerId={userId} initialMessages={guestbookMessages} isOwner={true} canPost={true} />
            </div>
          </>
        }
        aside={
          <>
            <WritingStatsCard
              articleCount={writingStats.total}
              totalWords={writingStats.totalWords}
              streak={writingStats.streak}
              thisMonth={writingStats.thisMonth}
            />
            <ChatActivityCard
              directCount={chatActivity.directCount}
              channelCount={chatActivity.channelCount}
              weeklyActive={chatActivity.weeklyActive}
              participants={chatActivity.participants}
            />
            <JobFunnelCard steps={funnelSteps} conversionRate={offerConversion} />
            <VisitOverviewCard
              total={visitDashboard.total}
              uniqueVisitors={visitDashboard.uniqueVisitors}
              last30={visitDashboard.last30}
              trend={visitDashboard.trend}
              recentVisitors={visitDashboard.recentVisitors}
            />
            <CompactHeatmapCard
              contentData={articleActivityData}
              chatData={chatActivity.heatmap}
              careerData={jobActivityData}
              days={180}
            />
          </>
        }
      />
    </PersonalHomeShell>
  )
}
