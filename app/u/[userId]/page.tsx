import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, ArrowRight, BookOpen, BriefcaseBusiness, CalendarDays, FileText, MessageSquareText, NotebookText, type LucideIcon } from "lucide-react"
import { prisma } from "@/lib/db"
import { getPosts } from "@/lib/mdx"
import { getOptionalSession } from "@/lib/auth"
import { canViewModule, getAccessLevel, recordVisit, visibleTo, type ModuleKey } from "@/lib/permissions"
import { ContributionActivityPanel } from "@/components/contribution-activity-panel"
import { FunnelChart } from "@/components/funnel-chart"
import { GuestbookSection } from "@/components/guestbook-section"
import { StatsCard } from "@/components/stats-card"
import { StatusBadge } from "@/components/status-badge"
import { UserAvatar } from "@/components/user-avatar"
import { VisitStatsPanel } from "@/components/visit-stats-panel"
import { formatChinaDate, formatDateKey } from "@/lib/time"
import { countWords } from "@/lib/text-stats"

const ARTICLE_MODULES = [
  { key: "blog" as const, label: "博客" },
  { key: "reflections" as const, label: "心得" },
  { key: "notes" as const, label: "笔记" },
]

function isSubmittedOnly(status: string) {
  return status.includes("已投递") || status.includes("宸叉姇")
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
  if (!enabled) return { directCount: 0, channelCount: 0, weeklyActive: 0, heatmap: {} as Record<string, number> }
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
  return { directCount: directSent.length + directReceived.length, channelCount: channelMessages.length, weeklyActive, heatmap }
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

function ModuleLink({ href, label, visible, icon: Icon }: { href: string; label: string; visible: boolean; icon: LucideIcon }) {
  const className = "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-all duration-200 hover:no-underline bg-[--color-bg-hover] text-[--color-text-secondary] hover:bg-[--color-brand-soft] hover:text-[--color-brand] hover:-translate-y-px"
  if (!visible) {
    return (
      <span className={`${className} cursor-not-allowed text-[--color-text-muted] opacity-50`} title="该模块暂未对好友开放">
        <Icon size={14} /> {label}
      </span>
    )
  }
  return (
    <Link href={href} className={`${className} text-[--color-text-secondary] hover:bg-[--color-bg-hover] hover:text-[--color-text-primary]`}>
      <Icon size={14} /> {label}
    </Link>
  )
}

function SectionTitle({ title, href, visible = true }: { title: string; href?: string; visible?: boolean }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-[--color-text-muted]">{title}</h2>
      {href && visible && (
        <Link href={href} className="flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium text-[--color-text-muted] transition-colors hover:bg-[--color-brand-soft] hover:text-[--color-brand] hover:no-underline">
          全部 <ArrowRight size={12} />
        </Link>
      )}
    </div>
  )
}

export default async function UserProfilePage({ params }: { params: Promise<{ userId: string }> }) {
  const [{ userId: ownerId }, session] = await Promise.all([params, getOptionalSession()])
  const owner = await prisma.user.findUnique({
    where: { id: ownerId },
    select: { id: true, displayName: true, email: true, bio: true, avatarText: true, avatarUrl: true },
  })
  if (!owner) notFound()

  const level = await getAccessLevel(session?.userId ?? null, ownerId)
  if (level === "none") notFound()

  const moduleEntries: [ModuleKey, boolean][] = await Promise.all(
    (["home", "resume", "blog", "daily", "reflections", "notes", "jobs", "interviews"] as ModuleKey[]).map(
      async (module) => [module, await canViewModule(ownerId, module, level)] as [ModuleKey, boolean]
    )
  )
  const modules = Object.fromEntries(moduleEntries) as Record<ModuleKey, boolean>
  await recordVisit({ ownerId, visitorId: session?.userId ?? null, module: "home", path: `/u/${ownerId}` })

  const displayName = owner.displayName || owner.email
  const showHomeContent = modules.home
  const visibilities = visibleTo(level)
  const enabledArticleTypes = showHomeContent ? ARTICLE_MODULES.filter((module) => modules[module.key]).map((module) => module.key) : []
  const jobsEnabled = showHomeContent && modules.jobs
  const dailyEnabled = showHomeContent && modules.daily

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
  ] = await Promise.all([
    getJobStats(ownerId, jobsEnabled),
    getRecentJobs(ownerId, jobsEnabled),
    getArticleActivityData(ownerId, enabledArticleTypes, visibilities, dailyEnabled),
    getJobActivityData(ownerId, jobsEnabled),
    getChatActivityData(ownerId, showHomeContent),
    getWritingStats(ownerId, enabledArticleTypes, visibilities, dailyEnabled),
    Promise.all(
      ARTICLE_MODULES.map(async (module) =>
        showHomeContent && modules[module.key]
          ? (await getPosts(module.key, ownerId, visibilities)).map((post) => ({ ...post, typeLabel: module.label }))
          : []
      )
    ),
    dailyEnabled ? getPosts("daily", ownerId, visibilities) : [],
    prisma.guestbookMessage.findMany({
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
        sticker: message.sticker ? { ...message.sticker, url: `/api/stickers/${message.sticker.id}/file` } : null,
        createdAt: message.createdAt.toISOString(),
        author: message.author,
      }))
    ),
  ])

  const allPosts = articleGroups.flat().sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 5)
  const funnelSteps = [
    { label: "累计投递", value: stats.total, color: "#9A9A9A" },
    { label: "收到回复", value: stats.replied, color: "#B8902D" },
    { label: "进入面试", value: stats.hasInterview, color: "#0969DA" },
    { label: "拿到 Offer", value: stats.offers, color: "#3A7D5C" },
  ]

  return (
    <div className="mx-auto max-w-[1200px] px-6 pt-6 pb-10">
      <header className="mb-8">
        {level === "friend" && (
          <Link href="/friends" className="mb-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs text-[--color-text-muted] transition-colors hover:bg-[--color-brand-soft] hover:text-[--color-brand] hover:no-underline">
            <ArrowLeft size={13} /> 返回好友
          </Link>
        )}
        <div className="flex items-start gap-5 rounded-[--radius-xl] bg-[linear-gradient(135deg,rgba(37,99,235,0.04)_0%,rgba(255,255,255,0.6)_40%,rgba(255,255,255,0.82)_100%)] px-6 py-5 shadow-[--shadow-sm] ring-1 ring-[--color-border]">
          <UserAvatar name={displayName} email={owner.email} avatarText={owner.avatarText} avatarUrl={owner.avatarUrl} size="md" className="mt-0.5" />
          <div className="min-w-0 space-y-1">
            <h1 className="text-lg font-bold tracking-tight text-[--color-text-primary]">{displayName}</h1>
            {owner.bio && <p className="line-clamp-2 text-sm leading-relaxed text-[--color-text-secondary]">{owner.bio}</p>}
            <p className="break-all text-xs text-[--color-text-muted]">{owner.email}</p>
          </div>
        </div>
        {!showHomeContent && <p className="mt-4 text-sm text-[--color-text-muted]">主页内容暂未对好友开放。</p>}
      </header>

      {showHomeContent && (
        <>
          <section className="mb-10 border-b border-[rgba(15,23,42,0.06)] pb-10">
            <SectionTitle title="写作统计" />
            <div className="mb-6 grid grid-cols-4 gap-1.5 sm:gap-3">
              <StatsCard title="累计文章" value={writingStats.total} sub="篇" />
              <StatsCard title="总字数" value={writingStats.totalWords > 10000 ? `${Math.round(writingStats.totalWords / 1000)}k` : writingStats.totalWords} sub="字" />
              <StatsCard title="连续写作" value={writingStats.streak} sub="天" trend={writingStats.streak > 0 ? "up" : "neutral"} />
              <StatsCard title="本月新增" value={writingStats.thisMonth} sub="篇" />
            </div>
          </section>

          <div className="mb-10 grid min-w-0 gap-8 border-b border-[rgba(15,23,42,0.06)] pb-10 md:grid-cols-2">
            <section className="min-w-0">
              <SectionTitle title="最近文章" href={`/u/${ownerId}/blog`} visible={modules.blog} />
              {allPosts.length === 0 ? (
                <p className="text-sm text-[--color-text-muted]">暂无可见文章</p>
              ) : (
                allPosts.map((post) => (
                  <Link key={`${post.type}-${post.slug}`} href={`/u/${ownerId}/${post.type}/${encodeURIComponent(post.slug)}`} className="block min-w-0 group hover:no-underline">
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
            </section>

            <section className="min-w-0">
              <SectionTitle title="最近日常" href={`/u/${ownerId}/daily`} visible={modules.daily} />
              {recentDaily.length === 0 ? (
                <p className="text-sm text-[--color-text-muted]">暂无可见日常记录</p>
              ) : (
                recentDaily.slice(0, 5).map((post) => (
                  <Link key={post.slug} href={`/u/${ownerId}/daily/${encodeURIComponent(post.slug)}`} className="block min-w-0 group hover:no-underline">
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
            </section>
          </div>

          <section className="mb-10 border-b border-[rgba(15,23,42,0.06)] pb-10">
            <SectionTitle title="聊天活跃度" />
            <div className="mb-4 grid grid-cols-4 gap-1.5 sm:gap-3">
              <StatsCard title="单聊参与" value={chatActivity.directCount} sub="次" />
              <StatsCard title="群聊发言" value={chatActivity.channelCount} sub="次" />
              <StatsCard title="总互动" value={chatActivity.directCount + chatActivity.channelCount} sub="次" />
              <StatsCard title="本周活跃" value={chatActivity.weeklyActive} sub="次" />
            </div>
          </section>

          <section className="mb-10 border-b border-[rgba(15,23,42,0.06)] pb-10">
            <SectionTitle title="求职漏斗" href={`/u/${ownerId}/jobs`} visible={modules.jobs} />
            <div className="mb-4 grid grid-cols-4 gap-1.5 sm:gap-3">
              <StatsCard title="累计投递" value={stats.total} sub="家公司" />
              <StatsCard title="回复率" value={`${stats.replyRate}%`} sub={stats.replyRate > 50 ? "还不错" : "继续加油"} trend={stats.replyRate > 50 ? "up" : "neutral"} />
              <StatsCard title="面试机会" value={stats.hasInterview} sub="次" />
              <StatsCard title="Offer 数" value={stats.offers} sub={stats.offers > 0 ? "恭喜" : "在路上"} trend={stats.offers > 0 ? "up" : "neutral"} />
            </div>
            {stats.total > 0 && (
              <div className="rounded-[--radius-lg] bg-[--color-bg-surface]/70 p-5 shadow-[--shadow-sm] ring-1 ring-[rgba(15,23,42,0.05)] backdrop-blur-sm">
                <p className="mb-3 text-xs font-medium text-[--color-text-muted]">投递转化漏斗</p>
                <FunnelChart steps={funnelSteps} />
              </div>
            )}
          </section>

          <section className="mb-10 border-b border-[rgba(15,23,42,0.06)] pb-10">
            <SectionTitle title="最近求职动态" href={`/u/${ownerId}/jobs`} visible={modules.jobs} />
            {recentJobs.length === 0 ? (
              <p className="text-sm text-[--color-text-muted]">暂无可见求职动态</p>
            ) : (
              <div className="overflow-hidden rounded-[--radius-lg] bg-[--color-bg-surface] shadow-[--shadow-sm] ring-1 ring-[--color-border]">
                {recentJobs.map((job, index) => (
                  <div key={job.id} className={`flex min-w-0 items-center gap-2 px-3 py-3 sm:gap-4 sm:px-4 ${index < recentJobs.length - 1 ? "border-b border-[--color-border]" : ""}`}>
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

          <VisitStatsPanel userId={ownerId} />
        </>
      )}

      <section className="mt-10 border-t border-[rgba(15,23,42,0.06)] pt-8">
        <div className="flex flex-wrap gap-2">
          <ModuleLink href={`/u/${ownerId}/resume`} label="查看简历" visible={modules.resume} icon={FileText} />
          <ModuleLink href={`/u/${ownerId}/blog`} label="读博客" visible={modules.blog} icon={BookOpen} />
          <ModuleLink href={`/u/${ownerId}/daily`} label="看日常" visible={modules.daily} icon={CalendarDays} />
          <ModuleLink href={`/u/${ownerId}/reflections`} label="看心得" visible={modules.reflections} icon={MessageSquareText} />
          <ModuleLink href={`/u/${ownerId}/notes`} label="看笔记" visible={modules.notes} icon={NotebookText} />
          <ModuleLink href={`/u/${ownerId}/jobs`} label="求职进度" visible={modules.jobs} icon={BriefcaseBusiness} />
          <ModuleLink href={`/u/${ownerId}/interviews`} label="面试记录" visible={modules.interviews} icon={CalendarDays} />
        </div>
      </section>

      {showHomeContent && (
        <div className="mt-10 border-t border-[rgba(15,23,42,0.06)] pt-10">
          <ContributionActivityPanel
            contentData={articleActivityData}
            chatData={chatActivity.heatmap}
            careerData={jobActivityData}
            recentPosts={allPosts}
            recentDaily={recentDaily}
            recentJobs={recentJobs}
            chatActivity={chatActivity}
          />
        </div>
      )}

      <div className="mt-10 border-t border-[rgba(15,23,42,0.06)] pt-10">
        <GuestbookSection ownerId={ownerId} initialMessages={guestbookMessages} isOwner={level === "self"} canPost={level === "friend"} />
      </div>
    </div>
  )
}
