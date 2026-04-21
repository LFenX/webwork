import Link from "next/link"
import { prisma } from "@/lib/db"
import { getPosts } from "@/lib/mdx"
import { StatsCard } from "@/components/stats-card"
import { StatusBadge } from "@/components/status-badge"
import { ActivityHeatmap } from "@/components/activity-heatmap"
import { FunnelChart } from "@/components/funnel-chart"
import { ArrowRight, FileText, BookOpen, CalendarDays } from "lucide-react"

async function getSettings() {
  return prisma.siteSettings.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton" },
  })
}

async function getStats() {
  const jobs = await prisma.jobApplication.findMany()
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

async function getRecentJobs() {
  return prisma.jobApplication.findMany({ orderBy: { updatedAt: "desc" }, take: 3 })
}

function toLocalDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

async function getActivityData() {
  const [posts, jobs] = await Promise.all([
    prisma.post.findMany({ select: { date: true }, orderBy: { date: "desc" }, take: 1000 }),
    prisma.jobApplication.findMany({ select: { appliedAt: true }, orderBy: { appliedAt: "desc" }, take: 1000 }),
  ])
  const data: Record<string, number> = {}
  posts.forEach((p) => {
    const k = toLocalDate(p.date)
    data[k] = (data[k] ?? 0) + 1
  })
  jobs.forEach((j) => {
    const k = toLocalDate(j.appliedAt)
    data[k] = (data[k] ?? 0) + 1
  })
  return data
}

async function getWritingStats() {
  const posts = await prisma.post.findMany({ select: { content: true, date: true, type: true, tags: true } })
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

  const today = toLocalDate(new Date())
  const dateset = new Set(posts.map((p) => toLocalDate(p.date)))
  let streak = 0
  let cur = new Date()
  while (dateset.has(toLocalDate(cur))) {
    streak++
    cur.setDate(cur.getDate() - 1)
  }

  const thisMonth = posts.filter((p) => toLocalDate(p.date).slice(0, 7) === today.slice(0, 7)).length

  return { totalChars, topTags, streak, thisMonth, total: posts.length }
}

export default async function HomePage() {
  const [settings, stats, recentJobs, activityData, writingStats] = await Promise.all([
    getSettings(),
    getStats(),
    getRecentJobs(),
    getActivityData(),
    getWritingStats(),
  ])

  const allPosts = [
    ...(await getPosts("blog")).map((p) => ({ ...p, typeLabel: "博客" })),
    ...(await getPosts("reflections")).map((p) => ({ ...p, typeLabel: "心得" })),
    ...(await getPosts("notes")).map((p) => ({ ...p, typeLabel: "笔记" })),
  ]
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 5)

  const recentDaily = (await getPosts("daily")).slice(0, 5)

  const funnelSteps = [
    { label: "累计投递", value: stats.total, color: "#9A9A9A" },
    { label: "收到回复", value: stats.replied, color: "#B8902D" },
    { label: "进入面试", value: stats.hasInterview, color: "#0969DA" },
    { label: "拿到 Offer", value: stats.offers, color: "#3A7D5C" },
  ]

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-10">
      {/* Hero */}
      <section className="mb-10 pb-8 border-b border-[--color-border]">
        <h1 className="text-2xl font-semibold mb-2">你好，我是 {settings.ownerName}</h1>
        <p className="text-[--color-text-secondary] max-w-xl mb-5">{settings.heroTagline}</p>
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

      {/* Writing stats */}
      <section className="mb-10">
        <h2 className="text-xs font-semibold text-[--color-text-muted] uppercase tracking-wider mb-4">写作统计</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <StatsCard title="累计文章" value={writingStats.total} sub="篇" />
          <StatsCard title="总字数" value={writingStats.totalChars > 10000 ? `${Math.round(writingStats.totalChars / 1000)}k` : writingStats.totalChars} sub="字符" />
          <StatsCard title="连续写作" value={writingStats.streak} sub="天" trend={writingStats.streak > 0 ? "up" : "neutral"} />
          <StatsCard title="本月新增" value={writingStats.thisMonth} sub="篇" />
        </div>

        {/* Activity heatmap */}
        <div className="bg-[--color-bg-surface] border border-[--color-border] rounded-[--radius-lg] p-4 overflow-x-auto">
          <p className="text-xs text-[--color-text-muted] mb-3">近 52 周活跃热力图（文章 + 投递）</p>
          <ActivityHeatmap data={activityData} />
        </div>

        {/* Tag cloud */}
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
                <Link key={`${post.type}-${post.slug}`} href={`/${post.type}/${post.slug}`} className="block group hover:no-underline">
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
                <Link key={post.slug} href={`/daily/${post.slug}`} className="block group hover:no-underline">
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

      {/* Recent job activity */}
      {recentJobs.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-semibold text-[--color-text-muted] uppercase tracking-wider">最近求职动态</h2>
            <Link href="/jobs" className="text-xs text-[--color-text-muted] hover:text-[--color-link] flex items-center gap-1">
              全部 <ArrowRight size={12} />
            </Link>
          </div>
          <div className="bg-[--color-bg-surface] border border-[--color-border] rounded-[--radius-lg] overflow-hidden">
            {recentJobs.map((job, i) => (
              <div
                key={job.id}
                className={`flex items-center gap-4 px-4 py-3 ${i < recentJobs.length - 1 ? "border-b border-[--color-border]" : ""}`}
              >
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-sm">{job.company}</span>
                  <span className="text-[--color-text-muted] text-sm mx-1.5">·</span>
                  <span className="text-sm text-[--color-text-secondary]">{job.position}</span>
                </div>
                <StatusBadge status={job.status} type="job" />
                <span className="font-mono text-xs text-[--color-text-muted] shrink-0">
                  {new Date(job.appliedAt).toLocaleDateString("zh-CN")}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
