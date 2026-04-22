import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, ArrowRight, BookOpen, BriefcaseBusiness, CalendarDays, FileText, MessageSquareText, NotebookText, type LucideIcon } from "lucide-react"
import { prisma } from "@/lib/db"
import { getPosts } from "@/lib/mdx"
import { getOptionalSession } from "@/lib/auth"
import { canViewModule, getAccessLevel, recordVisit, visibleTo, type ModuleKey } from "@/lib/permissions"
import { ActivityHeatmap } from "@/components/activity-heatmap"
import { GuestbookSection } from "@/components/guestbook-section"
import { FunnelChart } from "@/components/funnel-chart"
import { StatsCard } from "@/components/stats-card"
import { StatusBadge } from "@/components/status-badge"
import { UserAvatar } from "@/components/user-avatar"
import { formatChinaDate, formatDateKey } from "@/lib/time"

const ARTICLE_MODULES = [
  { key: "blog" as const, label: "博客" },
  { key: "reflections" as const, label: "心得" },
  { key: "notes" as const, label: "笔记" },
]

async function getJobStats(userId: string, enabled: boolean) {
  if (!enabled) return { total: 0, replied: 0, replyRate: 0, hasInterview: 0, offers: 0 }
  const jobs = await prisma.jobApplication.findMany({ where: { userId } })
  const total = jobs.length
  const replied = jobs.filter((j) => j.status !== "已投递").length
  const hasInterview = jobs.filter((j) => ["进入面试", "已Offer", "已接受"].includes(j.status)).length
  const offers = jobs.filter((j) => ["已Offer", "已接受"].includes(j.status)).length
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

async function getActivityData(userId: string, enabledTypes: string[], visibilities: string[], jobsEnabled: boolean) {
  const [posts, jobs] = await Promise.all([
    enabledTypes.length > 0
      ? prisma.post.findMany({
          where: { userId, type: { in: enabledTypes }, visibility: { in: visibilities } },
          select: { date: true },
          orderBy: { date: "desc" },
          take: 1000,
        })
      : [],
    jobsEnabled
      ? prisma.jobApplication.findMany({
          where: { userId },
          select: { appliedAt: true },
          orderBy: { appliedAt: "desc" },
          take: 1000,
        })
      : [],
  ])
  const data: Record<string, number> = {}
  posts.forEach((p) => {
    const k = formatDateKey(p.date)
    data[k] = (data[k] ?? 0) + 1
  })
  jobs.forEach((j) => {
    const k = formatDateKey(j.appliedAt)
    data[k] = (data[k] ?? 0) + 1
  })
  return data
}

async function getWritingStats(userId: string, enabledTypes: string[], visibilities: string[]) {
  if (enabledTypes.length === 0) return { totalChars: 0, streak: 0, thisMonth: 0, total: 0, topTags: [] as { tag: string; count: number }[] }
  const posts = await prisma.post.findMany({
    where: { userId, type: { in: enabledTypes }, visibility: { in: visibilities } },
    select: { content: true, date: true, tags: true },
  })
  const totalChars = posts.reduce((s, p) => s + p.content.length, 0)
  const tagCount: Record<string, number> = {}
  posts.forEach((p) => {
    const tags = JSON.parse(p.tags || "[]") as string[]
    tags.forEach((t) => {
      tagCount[t] = (tagCount[t] ?? 0) + 1
    })
  })
  const topTags = Object.entries(tagCount)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 12)
    .map(([tag, count]) => ({ tag, count }))

  const today = formatDateKey(new Date())
  const dateset = new Set(posts.map((p) => formatDateKey(p.date)))
  let streak = 0
  const cur = new Date()
  while (dateset.has(formatDateKey(cur))) {
    streak++
    cur.setDate(cur.getDate() - 1)
  }

  const thisMonth = posts.filter((p) => formatDateKey(p.date).slice(0, 7) === today.slice(0, 7)).length
  return { totalChars, topTags, streak, thisMonth, total: posts.length }
}

function ModuleLink({
  href,
  label,
  visible,
  icon: Icon,
}: {
  href: string
  label: string
  visible: boolean
  icon: LucideIcon
}) {
  const className =
    "inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-[--color-border-strong] rounded-[--radius-sm] transition-colors hover:no-underline"
  if (!visible) {
    return (
      <span className={`${className} text-[--color-text-muted] opacity-50 cursor-not-allowed`} title="该模块暂未对好友开放">
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
  const enabledArticleTypes = showHomeContent
    ? ARTICLE_MODULES.filter((m) => modules[m.key]).map((m) => m.key)
    : []

  const [stats, recentJobs, activityData, writingStats, articleGroups, recentDaily, guestbookMessages] = await Promise.all([
    getJobStats(ownerId, showHomeContent && modules.jobs),
    getRecentJobs(ownerId, showHomeContent && modules.jobs),
    getActivityData(ownerId, enabledArticleTypes, visibilities, showHomeContent && modules.jobs),
    getWritingStats(ownerId, enabledArticleTypes, visibilities),
    Promise.all(
      ARTICLE_MODULES.map(async (m) =>
        showHomeContent && modules[m.key]
          ? (await getPosts(m.key, ownerId, visibilities)).map((p) => ({ ...p, typeLabel: m.label }))
          : []
      )
    ),
    showHomeContent && modules.daily ? getPosts("daily", ownerId, visibilities) : [],
    prisma.guestbookMessage.findMany({
      where: { ownerId },
      orderBy: { createdAt: "desc" },
      include: { author: { select: { id: true, displayName: true, email: true, avatarText: true, avatarUrl: true } } },
    }).then((msgs) =>
      msgs.map((m) => ({ id: m.id, content: m.content, createdAt: m.createdAt.toISOString(), author: m.author }))
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
    <div className="max-w-[1200px] mx-auto px-6 py-10">
      <header className="mb-10">
        {level === "friend" && (
          <Link href="/friends" className="mb-4 inline-flex items-center gap-1.5 text-xs text-[--color-text-muted] hover:text-[--color-accent] hover:no-underline">
            <ArrowLeft size={13} /> 返回好友
          </Link>
        )}
        <div className="flex items-start gap-4">
          <UserAvatar
            name={displayName}
            email={owner.email}
            avatarText={owner.avatarText}
            avatarUrl={owner.avatarUrl}
            size="xl"
            className="mt-0.5"
          />
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold mb-1">{displayName}</h1>
            <p className="text-sm text-[--color-text-muted]">{owner.email}</p>
            {owner.bio && <p className="text-sm text-[--color-text-muted] mt-2">{owner.bio}</p>}
          </div>
        </div>
        {!showHomeContent && <p className="text-sm text-[--color-text-muted] mt-4">主页内容暂未对好友开放。</p>}
      </header>

      <section className="mb-10">
        <h2 className="text-xs font-semibold text-[--color-text-muted] uppercase tracking-wider mb-4">写作统计</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <StatsCard title="累计文章" value={writingStats.total} sub="篇" />
          <StatsCard title="总字数" value={writingStats.totalChars > 10000 ? `${Math.round(writingStats.totalChars / 1000)}k` : writingStats.totalChars} sub="字符" />
          <StatsCard title="连续写作" value={writingStats.streak} sub="天" trend={writingStats.streak > 0 ? "up" : "neutral"} />
          <StatsCard title="本月新增" value={writingStats.thisMonth} sub="篇" />
        </div>
        <div className="bg-[--color-bg-surface] border border-[--color-border] rounded-[--radius-lg] p-4">
          <p className="text-xs text-[--color-text-muted] mb-3">近 26 周活跃热力图（文章 + 投递）</p>
          <ActivityHeatmap data={activityData} />
        </div>
      </section>

      <section className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-semibold text-[--color-text-muted] uppercase tracking-wider">求职漏斗</h2>
          <ModuleLink href={`/u/${ownerId}/jobs`} label="详情" visible={modules.jobs} icon={ArrowRight} />
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="grid grid-cols-2 gap-3">
            <StatsCard title="累计投递" value={stats.total} sub="家公司" />
            <StatsCard title="回复率" value={`${stats.replyRate}%`} sub={stats.replyRate > 50 ? "还不错" : "继续加油"} trend={stats.replyRate > 50 ? "up" : "neutral"} />
            <StatsCard title="面试机会" value={stats.hasInterview} sub="次" />
            <StatsCard title="Offer 数" value={stats.offers} sub={stats.offers > 0 ? "恭喜" : "在路上"} trend={stats.offers > 0 ? "up" : "neutral"} />
          </div>
          <div className="bg-[--color-bg-surface] border border-[--color-border] rounded-[--radius-lg] p-4">
            <p className="text-xs text-[--color-text-muted] mb-3">投递转化漏斗</p>
            <FunnelChart steps={funnelSteps} />
          </div>
        </div>
      </section>

      <div className="grid min-w-0 gap-8 mb-10 md:grid-cols-2">
        <section className="min-w-0">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-semibold text-[--color-text-muted] uppercase tracking-wider">最近文章</h2>
            <ModuleLink href={`/u/${ownerId}/blog`} label="全部" visible={modules.blog} icon={ArrowRight} />
          </div>
          <div className="min-w-0 space-y-0 overflow-hidden">
            {allPosts.length === 0 ? (
              <p className="text-sm text-[--color-text-muted]">暂无可见文章</p>
            ) : (
              allPosts.map((post) => (
                <Link key={`${post.type}-${post.slug}`} href={`/u/${ownerId}/${post.type}/${encodeURIComponent(post.slug)}`} className="block min-w-0 group hover:no-underline">
                  <div className="flex min-w-0 items-start gap-2 py-2.5 border-b border-[--color-border] sm:gap-3">
                    <span className="font-mono text-xs text-[--color-text-muted] mt-0.5 shrink-0 w-16 sm:w-[4.5rem]">{post.date?.slice(0, 10)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[--color-text-primary] group-hover:text-[--color-accent] transition-colors truncate">{post.title}</p>
                      {post.summary && <p className="text-xs text-[--color-text-muted] truncate mt-0.5">{post.summary}</p>}
                    </div>
                    <span className="max-w-[3rem] shrink-0 truncate text-xs text-[--color-text-muted]">{post.typeLabel}</span>
                  </div>
                </Link>
              ))
            )}
          </div>
        </section>

        <section className="min-w-0">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-semibold text-[--color-text-muted] uppercase tracking-wider">最近日常</h2>
            <ModuleLink href={`/u/${ownerId}/daily`} label="全部" visible={modules.daily} icon={ArrowRight} />
          </div>
          <div className="min-w-0 space-y-0 overflow-hidden">
            {recentDaily.length === 0 ? (
              <p className="text-sm text-[--color-text-muted]">暂无可见日常记录</p>
            ) : (
              recentDaily.slice(0, 5).map((post) => (
                <Link key={post.slug} href={`/u/${ownerId}/daily/${encodeURIComponent(post.slug)}`} className="block min-w-0 group hover:no-underline">
                  <div className="flex min-w-0 items-start gap-2 py-2.5 border-b border-[--color-border] sm:gap-3">
                    <span className="font-mono text-xs text-[--color-text-muted] mt-0.5 shrink-0 w-16 sm:w-[4.5rem]">{post.date?.slice(0, 10)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[--color-text-primary] group-hover:text-[--color-accent] transition-colors truncate">{post.title}</p>
                      {post.summary && <p className="text-xs text-[--color-text-muted] truncate mt-0.5">{post.summary}</p>}
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </section>
      </div>

      <section className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-semibold text-[--color-text-muted] uppercase tracking-wider">最近求职动态</h2>
          <ModuleLink href={`/u/${ownerId}/jobs`} label="全部" visible={modules.jobs} icon={ArrowRight} />
        </div>
        {recentJobs.length === 0 ? (
          <p className="text-sm text-[--color-text-muted]">暂无可见求职动态</p>
        ) : (
          <div className="bg-[--color-bg-surface] border border-[--color-border] rounded-[--radius-lg] overflow-hidden">
            {recentJobs.map((job, i) => (
              <div key={job.id} className={`flex min-w-0 items-center gap-2 px-3 py-3 sm:gap-4 sm:px-4 ${i < recentJobs.length - 1 ? "border-b border-[--color-border]" : ""}`}>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium">{job.company}</p>
                  <p className="truncate text-xs text-[--color-text-secondary] sm:text-sm">{job.position}</p>
                </div>
                <StatusBadge status={job.status} type="job" />
                <span className="hidden shrink-0 font-mono text-xs text-[--color-text-muted] sm:inline">
                  {formatChinaDate(job.appliedAt)}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-10 pt-8 border-t border-[--color-border]">
        <div className="flex flex-wrap gap-3">
          <ModuleLink href={`/u/${ownerId}/resume`} label="查看简历" visible={modules.resume} icon={FileText} />
          <ModuleLink href={`/u/${ownerId}/blog`} label="读博客" visible={modules.blog} icon={BookOpen} />
          <ModuleLink href={`/u/${ownerId}/daily`} label="看日常" visible={modules.daily} icon={CalendarDays} />
          <ModuleLink href={`/u/${ownerId}/reflections`} label="看心得" visible={modules.reflections} icon={MessageSquareText} />
          <ModuleLink href={`/u/${ownerId}/notes`} label="看笔记" visible={modules.notes} icon={NotebookText} />
          <ModuleLink href={`/u/${ownerId}/jobs`} label="求职进度" visible={modules.jobs} icon={BriefcaseBusiness} />
          <ModuleLink href={`/u/${ownerId}/interviews`} label="面试记录" visible={modules.interviews} icon={CalendarDays} />
        </div>
      </section>

      <GuestbookSection
        ownerId={ownerId}
        initialMessages={guestbookMessages}
        isOwner={level === "self"}
        canPost={level === "friend"}
      />
    </div>
  )
}
