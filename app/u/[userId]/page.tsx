import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { BarChart3, BookOpen, BriefcaseBusiness, CalendarDays, Edit3, FileText, MessageCircle, MessageSquareText, NotebookText, PenLine, Share2, Sparkles, UsersRound } from "lucide-react"
import { prisma } from "@/lib/db"
import { getPosts } from "@/lib/mdx"
import { getOptionalSession } from "@/lib/auth"
import { canViewModule, getAccessLevel, recordVisit, visibleTo, type ModuleKey } from "@/lib/permissions"
import { profileHref, resolveCreatorProfileRef } from "@/lib/profile"
import { absoluteSiteUrl } from "@/lib/seo"
import { GuestbookSection } from "@/components/guestbook-section"
import { formatDateKey } from "@/lib/time"
import { countWords } from "@/lib/text-stats"
import { hasJobReplySignal } from "@/lib/job-stats"
import {
  ChatActivityCard,
  type ChatParticipant,
  CompactHeatmapCard,
  CompactListPanel,
  ContentListPanel,
  JobFunnelCard,
  ModuleLinksCard,
  PersonalHeroCard,
  PersonalHomeGrid,
  PersonalHomeShell,
  VisitOverviewCard,
  WritingStatsCard,
  type VisitDetailItem,
  type PersonalContentItem,
  type PersonalMetric,
} from "@/components/profile/personal-home"

const ARTICLE_MODULES = [
  { key: "blog" as const, label: "博客" },
  { key: "reflections" as const, label: "心得" },
  { key: "notes" as const, label: "笔记" },
]

const PROFILE_MODULES: ModuleKey[] = ["home", "resume", "blog", "daily", "reflections", "notes", "jobs", "interviews"]
const PUBLIC_INDEX_MODULES: ModuleKey[] = ["resume", "blog", "daily", "reflections", "notes", "jobs", "interviews"]

export async function generateMetadata({ params }: { params: Promise<{ userId: string }> }): Promise<Metadata> {
  const { userId } = await params
  const owner = await resolveCreatorProfileRef(userId)
  const hasPublicEntry = owner
    ? (await Promise.all(PROFILE_MODULES.map((module) => canViewModule(owner.id, module, "public")))).some(Boolean)
    : false
  if (!owner || !hasPublicEntry) {
    return { robots: { index: false, follow: false } }
  }

  const title = `${owner.displayName || "公开用户"} 的公开主页`
  const description = owner.bio || "公开个人主页、模块入口和内容更新。"
  const url = absoluteSiteUrl(profileHref(owner))
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      type: "website",
    },
    robots: { index: true, follow: true },
  }
}

function isInterviewStatus(status: string) {
  return status.includes("面试") || status.includes("Offer") || status.includes("帴")
}

function isOfferStatus(status: string) {
  return status.includes("Offer") || status.includes("帴")
}

async function getJobStats(userId: string, enabled: boolean) {
  if (!enabled) return { total: 0, replied: 0, replyRate: 0, hasInterview: 0, offers: 0 }
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

async function getRecentJobs(userId: string, enabled: boolean) {
  if (!enabled) return []
  return prisma.jobApplication.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    take: 3,
  })
}

async function getArticleActivityData(userId: string, enabledTypes: string[], visibilities: string[], dailyEnabled: boolean) {
  const types = dailyEnabled ? [...enabledTypes, "daily"] : enabledTypes
  if (types.length === 0) return {}
  const posts = await prisma.post.findMany({
    where: { userId, type: { in: types }, visibility: { in: visibilities } },
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

async function getJobActivityData(userId: string, enabled: boolean) {
  if (!enabled) return {}
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

async function getChatActivityData(userId: string, enabled: boolean) {
  if (!enabled) return { directCount: 0, channelCount: 0, weeklyActive: 0, heatmap: {} as Record<string, number>, participants: [] as ChatParticipant[] }
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

async function getWritingStats(userId: string, enabledTypes: string[], visibilities: string[], dailyEnabled: boolean) {
  const types = dailyEnabled ? [...enabledTypes, "daily"] : enabledTypes
  if (types.length === 0) return { totalWords: 0, streak: 0, thisMonth: 0, total: 0, topTags: [] as { tag: string; count: number }[] }
  const posts = await prisma.post.findMany({
    where: { userId, type: { in: types }, visibility: { in: visibilities } },
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

async function getVisitDashboardData(userId: string, enabled: boolean, includeVisitors = false) {
  if (!enabled) return { total: 0, last30: 0, uniqueVisitors: 0, trend: [] as number[], recentVisitors: [] as VisitDetailItem[] }
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
    includeVisitors
      ? prisma.visitLog.findMany({
          where: { ownerId: userId, createdAt: { gte: since } },
          select: {
            id: true,
            module: true,
            path: true,
            createdAt: true,
            visitor: { select: { displayName: true, email: true, avatarText: true, avatarUrl: true } },
          },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
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

export default async function UserProfilePage({ params }: { params: Promise<{ userId: string }> }) {
  const [{ userId: ownerRef }, session] = await Promise.all([params, getOptionalSession()])
  const owner = await resolveCreatorProfileRef(ownerRef)
  if (!owner) notFound()
  const ownerId = owner.id

  const level = await getAccessLevel(session?.userId ?? null, ownerId)

  const moduleEntries: [ModuleKey, boolean][] = await Promise.all(
    PROFILE_MODULES.map(
      async (module) => [module, await canViewModule(ownerId, module, level)] as [ModuleKey, boolean]
    )
  )
  const modules = Object.fromEntries(moduleEntries) as Record<ModuleKey, boolean>
  const hasVisiblePublicIndexModule = PUBLIC_INDEX_MODULES.some((module) => modules[module])
  if (level === "public" && !modules.home && !hasVisiblePublicIndexModule) notFound()
  await recordVisit({ ownerId, visitorId: session?.userId ?? null, module: "home", path: `/u/${owner.publicRef}` })

  const displayName = owner.displayName || (level === "public" ? "公开用户" : owner.email)
  const isSelf = level === "self"
  const showHomeContent = modules.home
  const showIndexContent = showHomeContent || (level === "public" && hasVisiblePublicIndexModule)
  const showPrivateHomeWidgets = showHomeContent && level !== "public"
  const visibilities = visibleTo(level)
  const publicRef = owner.publicRef
  const enabledArticleTypes = showIndexContent ? ARTICLE_MODULES.filter((module) => modules[module.key]).map((module) => module.key) : []
  const jobsEnabled = showIndexContent && modules.jobs
  const dailyEnabled = showIndexContent && modules.daily

  const [
    stats,
    recentJobs,
    articleActivityData,
    jobActivityData,
    chatActivity,
    writingStats,
    articleGroups,
    recentDaily,
    guestbookMessages,
    visitDashboard,
  ] = await Promise.all([
    getJobStats(ownerId, jobsEnabled),
    getRecentJobs(ownerId, jobsEnabled),
    getArticleActivityData(ownerId, enabledArticleTypes, visibilities, dailyEnabled),
    getJobActivityData(ownerId, jobsEnabled),
    getChatActivityData(ownerId, showPrivateHomeWidgets),
    getWritingStats(ownerId, enabledArticleTypes, visibilities, dailyEnabled),
    Promise.all(
      ARTICLE_MODULES.map(async (module) =>
        showIndexContent && modules[module.key]
          ? (await getPosts(module.key, ownerId, visibilities)).map((post) => ({ ...post, typeLabel: module.label }))
          : []
      )
    ),
    dailyEnabled ? getPosts("daily", ownerId, visibilities) : [],
    showPrivateHomeWidgets
      ? prisma.guestbookMessage.findMany({
          where: { ownerId },
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
        )
      : Promise.resolve([]),
    getVisitDashboardData(ownerId, showHomeContent, isSelf),
  ])

  const allPostsFull = articleGroups.flat().sort((a, b) => (a.date < b.date ? 1 : -1))
  const latestArticleItems: PersonalContentItem[] = allPostsFull.slice(0, 3).map((post) => ({
    key: `${post.type}-${post.slug}`,
    title: post.title,
    href: `/u/${publicRef}/${post.type}/${encodeURIComponent(post.slug)}`,
    date: post.date,
    summary: post.summary,
    label: post.typeLabel,
    tags: post.tags,
    value: 12,
  }))
  const latestDailyItems: PersonalContentItem[] = recentDaily.slice(0, 4).map((post) => ({
    key: post.slug,
    title: post.title,
    href: `/u/${publicRef}/daily/${encodeURIComponent(post.slug)}`,
    date: post.date,
    summary: post.summary,
    tags: post.tags,
  }))
  const recentJobItems: PersonalContentItem[] = recentJobs.slice(0, 4).map((job) => ({
    key: job.id,
    title: `${job.company} · ${job.position}`,
    href: `/u/${publicRef}/jobs`,
    date: job.appliedAt.toISOString().slice(0, 10),
    summary: level === "public" ? job.baseLocation || "公开求职进展" : job.notes || job.baseLocation || "求职进展已更新",
    meta: job.status,
  }))

  const visibleModuleLinks = [
    { href: `/u/${publicRef}/resume`, label: "简历", visible: modules.resume, icon: FileText },
    { href: `/u/${publicRef}/blog`, label: "文章", visible: modules.blog, icon: BookOpen },
    { href: `/u/${publicRef}/daily`, label: "日常", visible: modules.daily, icon: CalendarDays },
    { href: `/u/${publicRef}/reflections`, label: "心得", visible: modules.reflections, icon: MessageSquareText },
    { href: `/u/${publicRef}/notes`, label: "笔记", visible: modules.notes, icon: NotebookText },
    { href: `/u/${publicRef}/jobs`, label: "求职", visible: modules.jobs, icon: BriefcaseBusiness },
    { href: `/u/${publicRef}/interviews`, label: "面试", visible: modules.interviews, icon: CalendarDays },
  ].filter((item) => item.visible)

  const firstReadableContent = modules.blog
    ? { label: "查看文章", href: `/u/${publicRef}/blog`, icon: BookOpen }
    : modules.daily
      ? { label: "查看日常", href: `/u/${publicRef}/daily`, icon: CalendarDays }
      : modules.notes
        ? { label: "查看笔记", href: `/u/${publicRef}/notes`, icon: NotebookText }
        : null

  const heroActions = isSelf
    ? [
        { label: "编辑资料", href: "/settings/profile", icon: Edit3, variant: "primary" as const },
        { label: "分享主页", href: `/u/${publicRef}`, copyHref: `/u/${publicRef}`, icon: Share2, variant: "ghost" as const },
        { label: "写文章", href: "/blog/new", icon: PenLine, variant: "primary" as const },
        { label: "蝶灵", href: "/ai", icon: Sparkles, variant: "secondary" as const },
        { label: "好友", href: "/friends", icon: UsersRound, variant: "ghost" as const },
        { label: "分析", href: "/sql", icon: BarChart3, variant: "ghost" as const },
      ]
    : [
        ...(firstReadableContent ? [{ ...firstReadableContent, variant: "secondary" as const }] : []),
        ...(level === "friend" ? [{ label: "留言", href: "#guestbook", icon: MessageCircle, variant: "primary" as const }] : []),
      ]

  const coreMetrics: PersonalMetric[] = [
    { label: "文章", value: allPostsFull.length, icon: FileText, tone: "blue" },
    { label: "总字数", value: writingStats.totalWords > 10000 ? `${Math.round(writingStats.totalWords / 1000)}k` : writingStats.totalWords, icon: UsersRound, tone: "green" },
    { label: "日常记录", value: recentDaily.length, icon: CalendarDays, tone: "orange" },
    { label: "求职动态", value: stats.total, icon: BriefcaseBusiness, tone: "red" },
  ]
  const funnelSteps = [
    { label: "投递", value: stats.total, color: "#6d9df8" },
    { label: "回复", value: stats.replied, color: "#69c08b" },
    { label: "面试", value: stats.hasInterview, color: "#f5a343" },
    { label: "Offer", value: stats.offers, color: "#ef6b73" },
  ]
  const offerConversion = stats.total > 0 ? Math.round((stats.offers / stats.total) * 100) : 0
  return (
    <PersonalHomeShell variant="public">
      <PersonalHomeGrid
        main={
          <>
            <PersonalHeroCard
              name={displayName}
              email={level === "public" ? null : owner.email}
              bio={owner.bio}
              location={owner.location}
              avatarText={owner.avatarText}
              avatarUrl={owner.avatarUrl}
              actions={heroActions}
              metrics={showIndexContent ? coreMetrics : undefined}
              backHref={!isSelf ? "/friends" : undefined}
              backLabel="返回好友"
              mobileTitle={displayName}
              publicMode={!isSelf}
            />

            {showIndexContent ? (
              <>
                <ContentListPanel
                  title="最新文章"
                  icon={BookOpen}
                  href={modules.blog ? `/u/${publicRef}/blog` : undefined}
                  items={latestArticleItems}
                  emptyTitle="暂无可见文章"
                  emptyDescription="对方还没有开放可浏览的文章。"
                  featureFirst
                />
                {dailyEnabled && (
                  <CompactListPanel
                    title="日常记录"
                    icon={CalendarDays}
                    href={`/u/${publicRef}/daily`}
                    items={latestDailyItems}
                    emptyTitle="暂无日常记录"
                    emptyDescription="还没有发布任何日常记录哦。"
                    tone="green"
                  />
                )}
                {jobsEnabled && (
                  <CompactListPanel
                    title="求职动态"
                    icon={BriefcaseBusiness}
                    href={`/u/${publicRef}/jobs`}
                    items={recentJobItems}
                    emptyTitle="暂无求职动态"
                    emptyDescription="还没有发布任何求职动态哦。"
                    tone="red"
                  />
                )}
              </>
            ) : null}

            <ModuleLinksCard links={visibleModuleLinks.map(({ href, label, icon }) => ({ href, label, icon }))} />
          </>
        }
        aside={
          showIndexContent ? (
            <>
              <WritingStatsCard
                articleCount={writingStats.total}
                totalWords={writingStats.totalWords}
                streak={writingStats.streak}
                thisMonth={writingStats.thisMonth}
              />
              {showPrivateHomeWidgets ? (
                <ChatActivityCard
                  directCount={chatActivity.directCount}
                  channelCount={chatActivity.channelCount}
                  weeklyActive={chatActivity.weeklyActive}
                  participants={chatActivity.participants}
                />
              ) : null}
              {jobsEnabled && <JobFunnelCard steps={funnelSteps} conversionRate={offerConversion} href={`/u/${publicRef}/jobs`} />}
              {showHomeContent ? (
                <VisitOverviewCard
                  total={visitDashboard.total}
                  uniqueVisitors={visitDashboard.uniqueVisitors}
                  last30={visitDashboard.last30}
                  trend={visitDashboard.trend}
                  recentVisitors={isSelf ? visitDashboard.recentVisitors : undefined}
                />
              ) : null}
              <CompactHeatmapCard
                title="访问热度"
                contentData={articleActivityData}
                chatData={chatActivity.heatmap}
                careerData={jobActivityData}
                days={30}
              />
            </>
          ) : (
            <ModuleLinksCard links={visibleModuleLinks.map(({ href, label, icon }) => ({ href, label, icon }))} />
          )
        }
      />

      {showPrivateHomeWidgets ? (
        <div id="guestbook" className="mt-4 scroll-mt-20 2xl:mt-5">
          <GuestbookSection ownerId={ownerId} initialMessages={guestbookMessages} isOwner={isSelf} canPost={level === "friend"} />
        </div>
      ) : null}
    </PersonalHomeShell>
  )
}
