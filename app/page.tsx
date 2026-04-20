import Link from "next/link"
import { prisma } from "@/lib/db"
import { getPosts } from "@/lib/mdx"
import { StatsCard } from "@/components/stats-card"
import { StatusBadge } from "@/components/status-badge"
import { ArrowRight, FileText, BookOpen, CalendarDays } from "lucide-react"

async function getStats() {
  const jobs = await prisma.jobApplication.findMany()
  const total = jobs.length
  const replied = jobs.filter((j) => j.status !== "已投递").length
  const hasInterview = jobs.filter((j) =>
    ["进入面试", "已Offer", "已接受"].includes(j.status)
  ).length
  const offers = jobs.filter((j) => ["已Offer", "已接受"].includes(j.status)).length
  return {
    total,
    replyRate: total > 0 ? Math.round((replied / total) * 100) : 0,
    hasInterview,
    offers,
  }
}

async function getRecentJobs() {
  return prisma.jobApplication.findMany({
    orderBy: { updatedAt: "desc" },
    take: 3,
  })
}

export default async function HomePage() {
  const [stats, recentJobs] = await Promise.all([getStats(), getRecentJobs()])
  const allPosts = [
    ...getPosts("blog").map((p) => ({ ...p, typeLabel: "博客" })),
    ...getPosts("reflections").map((p) => ({ ...p, typeLabel: "心得" })),
  ]
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 5)
  const recentDaily = getPosts("daily").slice(0, 5)

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-10">
      {/* Hero */}
      <section className="mb-10 pb-8 border-b border-[--color-border]">
        <h1 className="text-2xl font-semibold mb-2">你好，我是 XXX</h1>
        <p className="text-[--color-text-secondary] max-w-xl mb-5">
          这里是我的个人空间，记录博客、日常、心得，以及正在进行中的求职旅程。
        </p>
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
              <Icon size={14} />
              {label}
            </Link>
          ))}
        </div>
      </section>

      {/* Stats */}
      <section className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-semibold text-[--color-text-muted] uppercase tracking-wider">求职数据</h2>
          <Link href="/jobs" className="text-xs text-[--color-text-muted] hover:text-[--color-link] flex items-center gap-1">
            查看详情 <ArrowRight size={12} />
          </Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatsCard title="累计投递" value={stats.total} sub="家公司" />
          <StatsCard
            title="回复率"
            value={`${stats.replyRate}%`}
            sub={stats.replyRate > 50 ? "↑ 还不错" : "继续加油"}
            trend={stats.replyRate > 50 ? "up" : "neutral"}
          />
          <StatsCard title="面试机会" value={stats.hasInterview} sub="次" />
          <StatsCard
            title="Offer 数"
            value={stats.offers}
            sub={stats.offers > 0 ? "加油" : "在路上"}
            trend={stats.offers > 0 ? "up" : "neutral"}
          />
        </div>
      </section>

      {/* Recent content */}
      <div className="grid md:grid-cols-2 gap-8">
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
                <Link
                  key={`${post.type}-${post.slug}`}
                  href={`/${post.type}/${post.slug}`}
                  className="block group hover:no-underline"
                >
                  <div className="flex items-start gap-3 py-2.5 border-b border-[--color-border]">
                    <span className="font-mono text-xs text-[--color-text-muted] mt-0.5 shrink-0 w-[4.5rem]">
                      {post.date?.slice(0, 10)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[--color-text-primary] group-hover:text-[--color-accent] transition-colors truncate">
                        {post.title}
                      </p>
                      {post.summary && (
                        <p className="text-xs text-[--color-text-muted] truncate mt-0.5">{post.summary}</p>
                      )}
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
                <Link
                  key={post.slug}
                  href={`/daily/${post.slug}`}
                  className="block group hover:no-underline"
                >
                  <div className="flex items-start gap-3 py-2.5 border-b border-[--color-border]">
                    <span className="font-mono text-xs text-[--color-text-muted] mt-0.5 shrink-0 w-[4.5rem]">
                      {post.date?.slice(0, 10)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[--color-text-primary] group-hover:text-[--color-accent] transition-colors truncate">
                        {post.title}
                      </p>
                      {post.summary && (
                        <p className="text-xs text-[--color-text-muted] truncate mt-0.5">{post.summary}</p>
                      )}
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
        <section className="mt-10">
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
