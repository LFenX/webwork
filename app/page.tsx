import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { prisma } from "@/lib/db"
import { getPosts } from "@/lib/mdx"
import { requireAuth } from "@/lib/auth"
import { getAnnouncementFeed } from "@/lib/announcement-feed"
import { AnnouncementChannelBar } from "@/components/announcement-channel-bar"
import { ContributionActivityPanel } from "@/components/contribution-activity-panel"
import { FunnelChart } from "@/components/funnel-chart"
import { GuestbookSection } from "@/components/guestbook-section"
import { HomeLayoutBoard } from "@/components/home-layout-board"
import { StatsCard } from "@/components/stats-card"
import { StatusBadge } from "@/components/status-badge"
import { UserAvatar } from "@/components/user-avatar"
import { VisitStatsPanel } from "@/components/visit-stats-panel"
import { formatChinaDate, formatDateKey } from "@/lib/time"
import { normalizeHomeLayout } from "@/lib/home-layout"
import { countWords } from "@/lib/text-stats"
import { getUserSiteSettings } from "@/lib/settings"
import { getDictionary } from "@/lib/i18n"
import { RecentActivityPanel, type RecentActivityGroup, type RecentActivityItem } from "@/components/recent-activity-panel"
import { getReadRecentActivityIds } from "@/lib/recent-activity-reads"

export const dynamic = "force-dynamic"
export const fetchCache = "force-no-store"

const ARTICLE_TYPES = ["blog", "reflections", "notes"] as const

function isSubmittedOnly(status: string) {
  return status.includes("已投递") || status.includes("尚未开始")
}

function isInterviewStatus(status: string) {
  return status.includes("面试") || status.includes("Offer") || status.includes("待定")
}

function isOfferStatus(status: string) {
  return status.includes("Offer")
}

async function getJobStats(userId: string) {
  const jobs = await prisma.jobApplication.findMany({ where: { userId } })
  const total = jobs.length
  const replied = jobs.filter((job) => !isSubmittedOnly(job.status)).length
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
  const [directSent, directReceived, channelMessages] = await Promise.all([
    prisma.chatMessage.findMany({ where: { senderId: userId }, select: { createdAt: true }, take: 1000, orderBy: { createdAt: "desc" } }),
    prisma.chatMessage.findMany({ where: { receiverId: userId }, select: { createdAt: true }, take: 1000, orderBy: { createdAt: "desc" } }),
    prisma.channelMessage.findMany({ where: { senderId: userId }, select: { createdAt: true }, take: 1000, orderBy: { createdAt: "desc" } }),
  ])
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
  const rows = await prisma.$queryRaw<Array<{ displayName: string; email: string; bio: string; avatarText: string; avatarUrl: string | null; location: string }>>`
    SELECT "displayName", email, bio, "avatarText", "avatarUrl", location
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
        href: `/friends/chat/${friendId}`,
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
        href: `/channels?channel=${encodeURIComponent(channel.id)}`,
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
      href: `/channels?channel=soulwing-roundtable&discussion=${encodeURIComponent(discussion.id)}`,
      meta: discussion.status === "running" ? "正在讨论" : discussion.status === "completed" ? "可追问" : "待开始",
      time: activityTime.toISOString(),
      badge: discussion.slot === "morning" ? "晨间" : discussion.slot === "evening" ? "夜间" : "圆桌",
      tone: discussion.status === "running" ? "coral" : "blue",
    }
  })

  const groups: RecentActivityGroup[] = [
    { key: "chat", title: "聊天动态", subtitle: "按会话聚合未读消息", href: "/channels", icon: "chat", pulse: "bg-[#2563eb]", items: chatItems },
    { key: "friends", title: "好友动态", subtitle: "文章、求职、简历更新", href: "/friends", icon: "friends", pulse: "bg-[#c96442]", items: friendItems },
    { key: "community", title: "社区动态", subtitle: "新网站与新表情包", href: "/community/resources", icon: "community", pulse: "bg-[#3a7d5c]", items: communityItems },
    { key: "roundtable", title: "蝶灵圆桌", subtitle: "从频道进入具体议题", href: "/channels?channel=soulwing-roundtable", icon: "roundtable", pulse: "bg-[#b8902d]", items: roundtableItems },
  ]
  const readIds = await getReadRecentActivityIds(userId, groups.flatMap((group) => group.key === "chat" ? [] : group.items.map((item) => item.id)))
  return groups.map((group) => group.key === "chat" ? group : { ...group, items: group.items.filter((item) => !readIds.has(item.id)) })
}
function SectionTitle({ title, href, allLabel }: { title: string; href?: string; allLabel?: string }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-[--color-text-muted]">{title}</h2>
      {href && (
        <Link href={href} className="flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium text-[--color-text-muted] transition-colors hover:bg-[--color-brand-soft] hover:text-[--color-brand] hover:no-underline">
          {allLabel ?? "鍏ㄩ儴"} <ArrowRight size={12} />
        </Link>
      )}
    </div>
  )
}

export default async function HomePage({ searchParams }: { searchParams: Promise<{ layout?: string }> }) {
  const [session, query] = await Promise.all([requireAuth(), searchParams])
  const { userId } = session
  const userSettings = await getUserSiteSettings(userId)
  const dict = getDictionary(userSettings.language)

  const articleLabelMap: Record<string, string> = {
    blog: dict.nav.blog,
    reflections: dict.nav.reflections,
    notes: dict.nav.notes,
  }

  const [
    stats,
    recentJobs,
    articleActivityData,
    jobActivityData,
    chatActivity,
    writingStats,
    profile,
    guestbookMessages,
    announcements,
    homeLayout,
    articleGroups,
    recentDaily,
    recentActivity,
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
    getAnnouncementFeed(userId, 50),
    prisma.homeLayout.findUnique({ where: { userId }, select: { config: true } }).then((row) => normalizeHomeLayout(row?.config)),
    Promise.all(ARTICLE_TYPES.map(async (type) => (await getPosts(type, userId)).map((post) => ({ ...post, typeLabel: articleLabelMap[type] })))),
    getPosts("daily", userId),
    getRecentActivityHub(userId),
  ])

  const allPosts = articleGroups.flat().sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 5)
  const allPostsFull = articleGroups.flat().sort((a, b) => (a.date < b.date ? 1 : -1))
  const funnelSteps = [
    { label: "累计投递", value: stats.total, color: "#9A9A9A" },
    { label: "收到回复", value: stats.replied, color: "#B8902D" },
    { label: "进入面试", value: stats.hasInterview, color: "#0969DA" },
    { label: "拿到 Offer", value: stats.offers, color: "#3A7D5C" },
  ]
  const homeWidgets = [
    {
      id: "recentActivity" as const,
      content: <RecentActivityPanel groups={recentActivity} userId={userId} />,
    },
    {
      id: "writingStats" as const,
      content: (
        <section>
          <SectionTitle title="写作统计" />
          <div className="mb-6 grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-3">
            <StatsCard title="累计文章" value={writingStats.total} sub="篇" />
            <StatsCard title={dict.article.wordCount} value={writingStats.totalWords > 10000 ? `${Math.round(writingStats.totalWords / 1000)}k` : writingStats.totalWords} sub="字" />
            <StatsCard title="连续写作" value={writingStats.streak} sub="天" trend={writingStats.streak > 0 ? "up" : "neutral"} />
            <StatsCard title="本月新增" value={writingStats.thisMonth} sub="篇" />
          </div>
          {writingStats.topTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {writingStats.topTags.map(({ tag, count }) => (
                <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-[--color-bg-hover] px-2.5 py-0.5 text-xs font-medium text-[--color-text-secondary]">
                  {tag}
                  <span className="font-mono text-[--color-text-muted]">{count}</span>
                </span>
              ))}
            </div>
          )}
        </section>
      ),
    },
    {
      id: "recentPosts" as const,
      content: (
        <div className="grid min-w-0 gap-8 md:grid-cols-2">
          <section className="min-w-0">
            <SectionTitle title={dict.home.latestArticles} href="/blog" allLabel={dict.common.all} />
            <div className="min-w-0 overflow-hidden">
              {allPosts.length === 0 ? (
                <p className="text-sm text-[--color-text-muted]">还没有文章</p>
              ) : (
                allPosts.map((post) => (
                  <Link key={`${post.type}-${post.slug}`} href={`/${post.type}/${encodeURIComponent(post.slug)}`} className="block min-w-0 group hover:no-underline">
                    <div className="flex min-w-0 items-start gap-2 rounded-[--radius-sm] px-3 py-2.5 transition-colors hover:bg-[--color-bg-hover]/60 sm:gap-3">
                      <span className="mt-0.5 w-16 shrink-0 font-mono text-xs text-[--color-text-muted] sm:w-[4.5rem]">{post.date?.slice(0, 10)}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-[--color-text-primary] transition-colors group-hover:text-[--color-accent]">{post.title}</p>
                        {post.summary && <p className="mt-0.5 truncate text-xs text-[--color-text-muted]">{post.summary}</p>}
                      </div>
                      <span className="max-w-[3rem] shrink-0 truncate text-xs text-[--color-text-muted]">{post.typeLabel}</span>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </section>
          <section className="min-w-0">
            <SectionTitle title="最近日常" href="/daily" allLabel={dict.common.all} />
            <div className="min-w-0 overflow-hidden">
              {recentDaily.length === 0 ? (
                <p className="text-sm text-[--color-text-muted]">还没有日常记录</p>
              ) : (
                recentDaily.slice(0, 5).map((post) => (
                  <Link key={post.slug} href={`/daily/${encodeURIComponent(post.slug)}`} className="block min-w-0 group hover:no-underline">
                    <div className="flex min-w-0 items-start gap-2 rounded-[--radius-sm] px-3 py-2.5 transition-colors hover:bg-[--color-bg-hover]/60 sm:gap-3">
                      <span className="mt-0.5 w-16 shrink-0 font-mono text-xs text-[--color-text-muted] sm:w-[4.5rem]">{post.date?.slice(0, 10)}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-[--color-text-primary] transition-colors group-hover:text-[--color-accent]">{post.title}</p>
                        {post.summary && <p className="mt-0.5 truncate text-xs text-[--color-text-muted]">{post.summary}</p>}
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </section>
        </div>
      ),
    },
    {
      id: "chatActivity" as const,
      content: (
        <section>
          <SectionTitle title="聊天活跃度" />
          <div className="mb-4 grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-3">
            <StatsCard title="单聊参与" value={chatActivity.directCount} sub="次" />
            <StatsCard title="群聊发言" value={chatActivity.channelCount} sub="次" />
            <StatsCard title="总互动" value={chatActivity.directCount + chatActivity.channelCount} sub="次" />
            <StatsCard title="本周活跃" value={chatActivity.weeklyActive} sub="次" />
          </div>
        </section>
      ),
    },
    {
      id: "jobFunnel" as const,
      content: (
        <section>
          <SectionTitle title="求职漏斗" href="/jobs" allLabel={dict.common.all} />
          <div className="mb-4 grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-3">
            <StatsCard title="累计投递" value={stats.total} sub="家公司" />
            <StatsCard title={dict.jobs.replyRate} value={`${stats.replyRate}%`} sub={stats.replyRate > 50 ? "还不错" : "继续加油"} trend={stats.replyRate > 50 ? "up" : "neutral"} />
            <StatsCard title={dict.home.interviews} value={stats.hasInterview} sub="次" />
            <StatsCard title={dict.home.offers} value={stats.offers} sub={stats.offers > 0 ? "恭喜" : "在路上"} trend={stats.offers > 0 ? "up" : "neutral"} />
          </div>
          {stats.total > 0 && (
            <div className="rounded-[--radius-lg] bg-[--color-bg-surface]/70 p-5 shadow-[--shadow-sm] ring-1 ring-[rgba(15,23,42,0.05)] backdrop-blur-sm">
              <p className="mb-3 text-xs font-medium text-[--color-text-muted]">投递转化漏斗</p>
              <FunnelChart steps={funnelSteps} />
            </div>
          )}
        </section>
      ),
    },
    {
      id: "recentJobs" as const,
      content: (
        <section>
          <SectionTitle title="最近求职动态" href="/jobs" allLabel={dict.common.all} />
          {recentJobs.length === 0 ? (
            <p className="text-sm text-[--color-text-muted]">{dict.common.noData}</p>
          ) : (
            <div className="overflow-hidden rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface]">
              {recentJobs.slice(0, 5).map((job, index) => (
                <div key={job.id} className={`flex min-w-0 items-center gap-2 px-3 py-3 sm:gap-4 sm:px-4 ${index < Math.min(recentJobs.length, 5) - 1 ? "border-b border-[--color-border]" : ""}`}>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{job.company}</p>
                    <p className="truncate text-xs text-[--color-text-secondary] sm:text-sm">{job.position}</p>
                  </div>
                  <StatusBadge status={job.status} type="job" />
                  <span className="hidden shrink-0 font-mono text-xs text-[--color-text-muted] sm:inline">{formatChinaDate(job.appliedAt)}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      ),
    },
    { id: "visitStats" as const, content: <VisitStatsPanel userId={userId} /> },
  ]
  return (
    <div className="mx-auto max-w-[1200px] px-6 pb-10 pt-6">
      <AnnouncementChannelBar
        initialAnnouncements={announcements}
        userId={userId}
        locale={userSettings.language}
        currentUser={{
          id: userId,
          email: profile?.email ?? session.email,
          displayName: profile?.displayName ?? profile?.email ?? session.email,
          avatarText: profile?.avatarText ?? "",
          avatarUrl: profile?.avatarUrl ?? null,
        }}
      />

      {profile && (
        <section className="mb-8 flex items-center gap-5 rounded-[--radius-xl] bg-[linear-gradient(135deg,rgba(37,99,235,0.04)_0%,rgba(255,255,255,0.6)_40%,rgba(255,255,255,0.82)_100%)] px-6 py-5 shadow-[--shadow-sm] ring-1 ring-[--color-border]">
          <UserAvatar size="md" name={profile.displayName} email={profile.email} avatarText={profile.avatarText} avatarUrl={profile.avatarUrl} />
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h1 className="text-lg font-bold tracking-tight text-[--color-text-primary]">{profile.displayName || profile.email}</h1>
              {profile.location && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[--color-bg-hover] px-2.5 py-0.5 text-xs text-[--color-text-secondary]">{profile.location}</span>
              )}
            </div>
            {profile.bio && <p className="line-clamp-2 text-sm leading-relaxed text-[--color-text-secondary]">{profile.bio}</p>}
            <p className="break-all text-xs text-[--color-text-muted]">{profile.email}</p>
          </div>
        </section>
      )}
      <HomeLayoutBoard
        widgets={homeWidgets}
        initialLayout={homeLayout}
        editable
        initialEditing={query.layout === "edit"}
        showEditTrigger={false}
      />

      <div className="mt-8">
        <ContributionActivityPanel
          contentData={articleActivityData}
          chatData={chatActivity.heatmap}
          careerData={jobActivityData}
          recentPosts={allPostsFull}
          recentDaily={recentDaily}
          recentJobs={recentJobs}
          chatActivity={chatActivity}
        />
      </div>

      <div className="mt-10">
        <GuestbookSection ownerId={userId} initialMessages={guestbookMessages} isOwner={true} canPost={true} />
      </div>

    </div>
  )
}
