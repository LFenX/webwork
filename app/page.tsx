import Link from "next/link"
import { prisma } from "@/lib/db"
import { getPosts } from "@/lib/mdx"
import { requireAuth } from "@/lib/auth"
import { getModuleVisibility } from "@/lib/permissions"
import { StatsCard } from "@/components/stats-card"
import { StatusBadge } from "@/components/status-badge"
import { ActivityHeatmap } from "@/components/activity-heatmap"
import { FunnelChart } from "@/components/funnel-chart"
import { ModuleVisibilitySelect } from "@/components/module-visibility-select"
import { VisitStatsPanel } from "@/components/visit-stats-panel"
import { UserAvatar } from "@/components/user-avatar"
import { ArrowRight, FileText, BookOpen, CalendarDays } from "lucide-react"
import { formatChinaDate, formatDateKey } from "@/lib/time"
import { GuestbookSection } from "@/components/guestbook-section"

export const dynamic = "force-dynamic"
export const fetchCache = "force-no-store"

async function getStats(userId: string) {
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

async function getRecentJobs(userId: string) {
  return prisma.jobApplication.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    take: 3,
  })
}

async function getActivityData(userId: string) {
  const [posts, jobs] = await Promise.all([
    prisma.post.findMany({ where: { userId }, select: { date: true }, orderBy: { date: "desc" }, take: 1000 }),
    prisma.jobApplication.findMany({ where: { userId }, select: { appliedAt: true }, orderBy: { appliedAt: "desc" }, take: 1000 }),
  ])
  const data: Record<string, number> = {}
  posts.forEach((p) => { const k = formatDateKey(p.date); data[k] = (data[k] ?? 0) + 1 })
  jobs.forEach((j) => { const k = formatDateKey(j.appliedAt); data[k] = (data[k] ?? 0) + 1 })
  return data
}

async function getWritingStats(userId: string) {
  const posts = await prisma.post.findMany({
    where: { userId },
    select: { content: true, date: true, type: true, tags: true },
  })
  const totalChars = posts.reduce((s, p) => s + p.content.length, 0)

  const tagCount: Record<string, number> = {}
  posts.forEach((p) => {
    const tags = JSON.parse(p.tags || "[]") as string[]
    tags.forEach((t) => { tagCount[t] = (tagCount[t] ?? 0) + 1 })
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

async function getProfile(userId: string) {
  const rows = await prisma.$queryRaw<Array<{ displayName: string; email: string; bio: string; avatarText: string; avatarUrl: string | null; location: string }>>`
    SELECT displayName, email, bio, avatarText, avatarUrl, location
    FROM User
    WHERE id = ${userId}
    LIMIT 1
  `
  return rows[0] ?? null
}

export default async function HomePage() {
  const session = await requireAuth()
  const { userId } = session

  const [stats, recentJobs, activityData, writingStats, profile, guestbookMessages] = await Promise.all([
    getStats(userId),
    getRecentJobs(userId),
    getActivityData(userId),
    getWritingStats(userId),
    getProfile(userId),
    prisma.guestbookMessage.findMany({
      where: { ownerId: userId },
      orderBy: { createdAt: "desc" },
      include: { author: { select: { id: true, displayName: true, email: true, avatarText: true, avatarUrl: true } } },
    }).then((msgs) =>
      msgs.map((m) => ({ id: m.id, content: m.content, createdAt: m.createdAt.toISOString(), author: m.author }))
    ),
  ])
  const homeVisibility = await getModuleVisibility(userId, "home")

  const allPosts = [
    ...(await getPosts("blog", userId)).map((p) => ({ ...p, typeLabel: "博客" })),
    ...(await getPosts("reflections", userId)).map((p) => ({ ...p, typeLabel: "心得" })),
    ...(await getPosts("notes", userId)).map((p) => ({ ...p, typeLabel: "笔记" })),
  ]
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 5)

  const recentDaily = (await getPosts("daily", userId)).slice(0, 5)

  const funnelSteps = [
    { label: "累计投递", value: stats.total, color: "#9A9A9A" },
    { label: "收到回复", value: stats.replied, color: "#B8902D" },
    { label: "进入面试", value: stats.hasInterview, color: "#0969DA" },
    { label: "拿到 Offer", value: stats.offers, color: "#3A7D5C" },
  ]

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-10">
      {profile && (
        <section className="mb-8 flex items-center gap-4 border border-[--color-border] bg-[--color-bg-surface] rounded-[--radius-lg] px-4 py-4">
          <UserAvatar
            size="md"
            name={profile.displayName}
            email={profile.email}
            avatarText={profile.avatarText}
            avatarUrl={profile.avatarUrl}
          />
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h1 className="text-base font-semibold text-[--color-text-primary]">{profile.displayName || profile.email}</h1>
              {profile.location && <span className="text-xs text-[--color-text-muted]">{profile.location}</span>}
            </div>
            {profile.bio && <p className="text-sm text-[--color-text-secondary] line-clamp-2">{profile.bio}</p>}
            <p className="text-xs text-[--color-text-muted] font-mono break-all">{profile.email}</p>
          </div>
        </section>
      )}
      <div className="flex justify-end mb-6">
        <ModuleVisibilitySelect module="home" initialVisibility={homeVisibility} />
      </div>

      {/* Writing stats */}
      <section className="mb-10">
        <h2 className="text-xs font-semibold text-[--color-text-muted] uppercase tracking-wider mb-4">写作统计</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <StatsCard title="累计文章" value={writingStats.total} sub="篇" />
          <StatsCard title="总字数" value={writingStats.totalChars > 10000 ? `${Math.round(writingStats.totalChars / 1000)}k` : writingStats.totalChars} sub="字符" />
          <StatsCard title="连续写作" value={writingStats.streak} sub="天" trend={writingStats.streak > 0 ? "up" : "neutral"} />
          <StatsCard title="本月新增" value={writingStats.thisMonth} sub="篇" />
        </div>
        <div className="bg-[--color-bg-surface] border border-[--color-border] rounded-[--radius-lg] p-4 overflow-x-auto">
          <p className="text-xs text-[--color-text-muted] mb-3">近 52 周活跃热力图（文章 + 投递）</p>
          <ActivityHeatmap data={activityData} />
        </div>
        {writingStats.topTags.length > 0 && (
          <div className="mt-4">
            <p className="text-xs text-[--color-text-muted] mb-2">常用标签</p>
            <div className="flex flex-wrap gap-1.5">
              {writingStats.topTags.map(({ tag, count }) => (
                <span key={tag} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-[--color-bg-hover] text-[--color-text-secondary] rounded border border-[--color-border]">
                  {tag}
                  <span className="text-[--color-text-muted] font-mono">{count}</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Job funnel */}
      <section className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-semibold text-[--color-text-muted] uppercase tracking-wider">求职漏斗</h2>
          <Link href="/jobs" className="text-xs text-[--color-text-muted] hover:text-[--color-link] flex items-center gap-1">
            详情 <ArrowRight size={12} />
          </Link>
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="grid grid-cols-2 gap-3">
            <StatsCard title="累计投递" value={stats.total} sub="家公司" />
            <StatsCard title="回复率" value={`${stats.replyRate}%`} sub={stats.replyRate > 50 ? "↑ 还不错" : "继续加油"} trend={stats.replyRate > 50 ? "up" : "neutral"} />
            <StatsCard title="面试机会" value={stats.hasInterview} sub="次" />
            <StatsCard title="Offer 数" value={stats.offers} sub={stats.offers > 0 ? "恭喜" : "在路上"} trend={stats.offers > 0 ? "up" : "neutral"} />
          </div>
          {stats.total > 0 && (
            <div className="bg-[--color-bg-surface] border border-[--color-border] rounded-[--radius-lg] p-4">
              <p className="text-xs text-[--color-text-muted] mb-3">投递转化漏斗</p>
              <FunnelChart steps={funnelSteps} />
            </div>
          )}
        </div>
      </section>

      {/* Recent content */}
      <div className="grid md:grid-cols-2 gap-8 mb-10">
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-semibold text-[--color-text-muted] uppercase tracking-wider">最近文章</h2>
            <Link href="/blog" className="text-xs text-[--color-text-muted] hover:text-[--color-link] flex items-center gap-1">
              全部 <ArrowRight size={12} />
            </Link>
          </div>
          <div className="space-y-0">
            {allPosts.length === 0 ? (
              <p className="text-sm text-[--color-text-muted]">还没有文章</p>
            ) : (
              allPosts.map((post) => (
                <Link key={`${post.type}-${post.slug}`} href={`/${post.type}/${encodeURIComponent(post.slug)}`} className="block group hover:no-underline">
                  <div className="flex items-start gap-3 py-2.5 border-b border-[--color-border]">
                    <span className="font-mono text-xs text-[--color-text-muted] mt-0.5 shrink-0 w-[4.5rem]">{post.date?.slice(0, 10)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[--color-text-primary] group-hover:text-[--color-accent] transition-colors truncate">{post.title}</p>
                      {post.summary && <p className="text-xs text-[--color-text-muted] truncate mt-0.5">{post.summary}</p>}
                    </div>
                    <span className="text-xs text-[--color-text-muted] shrink-0">{post.typeLabel}</span>
                  </div>
                </Link>
              ))
            )}
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-semibold text-[--color-text-muted] uppercase tracking-wider">最近日常</h2>
            <Link href="/daily" className="text-xs text-[--color-text-muted] hover:text-[--color-link] flex items-center gap-1">
              全部 <ArrowRight size={12} />
            </Link>
          </div>
          <div className="space-y-0">
            {recentDaily.length === 0 ? (
              <p className="text-sm text-[--color-text-muted]">还没有日常记录</p>
            ) : (
              recentDaily.map((post) => (
                <Link key={post.slug} href={`/daily/${encodeURIComponent(post.slug)}`} className="block group hover:no-underline">
                  <div className="flex items-start gap-3 py-2.5 border-b border-[--color-border]">
                    <span className="font-mono text-xs text-[--color-text-muted] mt-0.5 shrink-0 w-[4.5rem]">{post.date?.slice(0, 10)}</span>
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

      <VisitStatsPanel userId={userId} />

      {/* Recent job activity */}
      {recentJobs.length > 0 && (
        <section className="mt-12">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-semibold text-[--color-text-muted] uppercase tracking-wider">最近求职动态</h2>
            <Link href="/jobs" className="text-xs text-[--color-text-muted] hover:text-[--color-link] flex items-center gap-1">
              全部 <ArrowRight size={12} />
            </Link>
          </div>
          <div className="bg-[--color-bg-surface] border border-[--color-border] rounded-[--radius-lg] overflow-hidden">
            {recentJobs.map((job, i) => (
              <div key={job.id} className={`flex items-center gap-4 px-4 py-3 ${i < recentJobs.length - 1 ? "border-b border-[--color-border]" : ""}`}>
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-sm">{job.company}</span>
                  <span className="text-[--color-text-muted] text-sm mx-1.5">·</span>
                  <span className="text-sm text-[--color-text-secondary]">{job.position}</span>
                </div>
                <StatusBadge status={job.status} type="job" />
                <span className="font-mono text-xs text-[--color-text-muted] shrink-0">
                  {formatChinaDate(job.appliedAt)}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <GuestbookSection
        ownerId={userId}
        initialMessages={guestbookMessages}
        isOwner={true}
        canPost={false}
      />

      {/* Quick links */}
      <section className="hidden">
        <div className="flex flex-wrap gap-3">
          {[
            { href: "/resume", label: "查看简历", icon: FileText },
            { href: "/blog", label: "读博客", icon: BookOpen },
            { href: "/jobs", label: "求职进度", icon: CalendarDays },
          ].map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-[--color-border-strong] rounded-[--radius-sm] text-[--color-text-secondary] hover:bg-[--color-bg-hover] hover:text-[--color-text-primary] transition-colors hover:no-underline"
            >
              <Icon size={14} /> {label}
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
