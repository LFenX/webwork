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

export const dynamic = "force-dynamic"
export const fetchCache = "force-no-store"

const ARTICLE_TYPES = ["blog", "reflections", "notes"] as const

function isSubmittedOnly(status: string) {
  return status.includes("已投递") || status.includes("宸叉姇")
}

function isInterviewStatus(status: string) {
  return status.includes("面试") || status.includes("Offer") || status.includes("帴")
}

function isOfferStatus(status: string) {
  return status.includes("Offer") || status.includes("帴")
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

function SectionTitle({ title, href, allLabel }: { title: string; href?: string; allLabel?: string }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-[--color-text-muted]">{title}</h2>
      {href && (
        <Link href={href} className="flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium text-[--color-text-muted] transition-colors hover:bg-[--color-brand-soft] hover:text-[--color-brand] hover:no-underline">
          {allLabel ?? "全部"} <ArrowRight size={12} />
        </Link>
      )}
    </div>
  )
}

export default async function HomePage() {
  const session = await requireAuth()
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
        sticker: message.sticker ? { ...message.sticker, url: `/api/stickers/${message.sticker.id}/file` } : null,
        createdAt: message.createdAt.toISOString(),
        author: message.author,
      }))
    ),
    getAnnouncementFeed(userId, 50),
    prisma.homeLayout.findUnique({ where: { userId }, select: { config: true } }).then((row) => normalizeHomeLayout(row?.config)),
    Promise.all(ARTICLE_TYPES.map(async (type) => (await getPosts(type, userId)).map((post) => ({ ...post, typeLabel: articleLabelMap[type] })))),
    getPosts("daily", userId),
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
      id: "writingStats" as const,
      content: (
        <section>
          <SectionTitle title="写作统计" />
          <div className="mb-6 grid grid-cols-4 gap-1.5 sm:gap-3">
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
          <div className="mb-4 grid grid-cols-4 gap-1.5 sm:gap-3">
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
          <div className="mb-4 grid grid-cols-4 gap-1.5 sm:gap-3">
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

      <div className="hidden">

      <section className="mb-10">
        <SectionTitle title="写作统计" />
        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
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

      <section className="mb-10">
        <SectionTitle title="聊天活跃度" />
        <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatsCard title="单聊参与" value={chatActivity.directCount} sub="次" />
          <StatsCard title="群聊发言" value={chatActivity.channelCount} sub="次" />
          <StatsCard title="总互动" value={chatActivity.directCount + chatActivity.channelCount} sub="次" />
          <StatsCard title="本周活跃" value={chatActivity.weeklyActive} sub="次" />
        </div>
      </section>

      <div className="mb-10 grid min-w-0 gap-8 md:grid-cols-2">
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

      <section className="mb-10">
        <SectionTitle title="求职漏斗" href="/jobs" allLabel={dict.common.all} />
        <div className="grid gap-6 md:grid-cols-2">
          <div className="grid grid-cols-2 gap-3">
            <StatsCard title="累计投递" value={stats.total} sub="家公司" />
            <StatsCard title={dict.jobs.replyRate} value={`${stats.replyRate}%`} sub={stats.replyRate > 50 ? "还不错" : "继续加油"} trend={stats.replyRate > 50 ? "up" : "neutral"} />
            <StatsCard title={dict.home.interviews} value={stats.hasInterview} sub="次" />
            <StatsCard title={dict.home.offers} value={stats.offers} sub={stats.offers > 0 ? "恭喜" : "在路上"} trend={stats.offers > 0 ? "up" : "neutral"} />
          </div>
          {stats.total > 0 && (
            <div className="rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface] p-4">
              <p className="mb-3 text-xs text-[--color-text-muted]">投递转化漏斗</p>
              <FunnelChart steps={funnelSteps} />
            </div>
          )}
        </div>
      </section>

      {recentJobs.length > 0 && (
        <section className="mb-10">
          <SectionTitle title="最近求职动态" href="/jobs" allLabel={dict.common.all} />
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
        </section>
      )}


      <GuestbookSection ownerId={userId} initialMessages={guestbookMessages} isOwner={true} canPost={true} />
      </div>
    </div>
  )
}
