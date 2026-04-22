import { format } from "date-fns"
import { ExternalLink } from "lucide-react"
import { notFound } from "next/navigation"
import Link from "next/link"
import { SimpleBarChart } from "@/components/charts/bar-chart"
import { SimpleLineChart } from "@/components/charts/line-chart"
import { StatsCard } from "@/components/stats-card"
import { StatusBadge } from "@/components/status-badge"
import { prisma } from "@/lib/db"
import { getOptionalSession } from "@/lib/auth"
import { canViewModule, getAccessLevel, recordVisit } from "@/lib/permissions"
import { JOB_STATUS } from "@/lib/enums"
import { formatChinaDate } from "@/lib/time"

const STATUS_COLORS: Record<string, string> = {
  [JOB_STATUS[0]]: "#9A9A9A",
  [JOB_STATUS[1]]: "#B8902D",
  [JOB_STATUS[2]]: "#0969DA",
  [JOB_STATUS[3]]: "#A8463A",
  [JOB_STATUS[4]]: "#3A7D5C",
  [JOB_STATUS[5]]: "#3A7D5C",
  [JOB_STATUS[6]]: "#D4D1C7",
}

function buildStats(jobs: Array<{ status: string; channel: string; appliedAt: Date }>) {
  const total = jobs.length
  const replied = jobs.filter((job) => job.status !== JOB_STATUS[0]).length
  const hasInterview = jobs.filter((job) => [JOB_STATUS[2], JOB_STATUS[4], JOB_STATUS[5]].includes(job.status as never)).length
  const offers = jobs.filter((job) => [JOB_STATUS[4], JOB_STATUS[5]].includes(job.status as never)).length

  const statusCount = new Map<string, number>()
  const channelCount = new Map<string, number>()
  const monthCount = new Map<string, number>()
  for (const job of jobs) {
    statusCount.set(job.status, (statusCount.get(job.status) ?? 0) + 1)
    channelCount.set(job.channel, (channelCount.get(job.channel) ?? 0) + 1)
    const month = format(job.appliedAt, "yyyy-MM")
    monthCount.set(month, (monthCount.get(month) ?? 0) + 1)
  }

  return {
    total,
    replyRate: total > 0 ? Math.round((replied / total) * 100) : 0,
    interviewRate: total > 0 ? Math.round((hasInterview / total) * 100) : 0,
    offerRate: total > 0 ? Math.round((offers / total) * 100) : 0,
    statusDist: Array.from(statusCount.entries()).map(([name, value]) => ({
      name,
      value,
      color: STATUS_COLORS[name] ?? "#9A9A9A",
    })),
    channelDist: Array.from(channelCount.entries())
      .sort(([, a], [, b]) => b - a)
      .map(([name, value]) => ({ name, value })),
    monthlyTrend: Array.from(monthCount.entries())
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([name, value]) => ({ name: name.slice(5), value })),
  }
}

export default async function UserJobsPage({ params }: { params: Promise<{ userId: string }> }) {
  const [{ userId: ownerId }, session] = await Promise.all([params, getOptionalSession()])
  const owner = await prisma.user.findUnique({
    where: { id: ownerId },
    select: { displayName: true, email: true },
  })
  if (!owner) notFound()

  const level = await getAccessLevel(session?.userId ?? null, ownerId)
  if (level === "none") notFound()

  const moduleVisible = await canViewModule(ownerId, "jobs", level)
  const jobs = moduleVisible
    ? await prisma.jobApplication.findMany({
        where: { userId: ownerId },
        orderBy: { appliedAt: "desc" },
        include: { _count: { select: { interviews: true } } },
      })
    : []

  await recordVisit({ ownerId, visitorId: session?.userId ?? null, module: "jobs", path: `/u/${ownerId}/jobs` })

  const displayName = owner.displayName || owner.email
  const stats = buildStats(jobs)

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-10">
      <div className="mb-8">
        <Link href={`/u/${ownerId}`} className="mb-2 block text-xs text-[--color-text-muted] hover:text-[--color-accent]">
          ← {displayName}
        </Link>
        <h1 className="mb-1 text-xl font-semibold">求职追踪</h1>
        <p className="text-sm text-[--color-text-muted]">记录每一次投递，追踪求职进度</p>
      </div>

      <section className="mb-8">
        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatsCard title="累计投递" value={stats.total} sub="家公司" />
          <StatsCard title="回复率" value={`${stats.replyRate}%`} sub={stats.replyRate > 50 ? "不错" : "继续加油"} trend={stats.replyRate > 50 ? "up" : "neutral"} />
          <StatsCard title="面试转化率" value={`${stats.interviewRate}%`} sub="进入面试" />
          <StatsCard title="Offer 率" value={`${stats.offerRate}%`} trend={stats.offerRate > 0 ? "up" : "neutral"} />
        </div>

        {stats.total > 0 && (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface] p-4">
              <p className="mb-3 text-xs text-[--color-text-muted]">按状态分布</p>
              <SimpleBarChart data={stats.statusDist} height={Math.max(120, stats.statusDist.length * 32)} />
            </div>
            <div className="rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface] p-4">
              <p className="mb-3 text-xs text-[--color-text-muted]">按渠道分布</p>
              <SimpleBarChart data={stats.channelDist} height={Math.max(120, stats.channelDist.length * 32)} />
            </div>
            {stats.monthlyTrend.length > 1 && (
              <div className="rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface] p-4">
                <p className="mb-3 text-xs text-[--color-text-muted]">按月投递趋势</p>
                <SimpleLineChart data={stats.monthlyTrend} height={180} />
              </div>
            )}
          </div>
        )}
      </section>

      <div className="overflow-hidden rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface]">
        {jobs.length === 0 ? (
          <div className="py-16 text-center text-sm text-[--color-text-muted]">暂无求职记录。</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-[--color-border-strong] bg-[--color-bg-hover]">
                  <th className="w-[120px] px-4 py-2.5 text-left text-xs font-medium text-[--color-text-muted]">公司</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-[--color-text-muted]">职位</th>
                  <th className="w-[80px] px-4 py-2.5 text-left text-xs font-medium text-[--color-text-muted]">渠道</th>
                  <th className="w-[90px] px-4 py-2.5 text-left font-mono text-xs font-medium text-[--color-text-muted]">投递日期</th>
                  <th className="w-[110px] px-4 py-2.5 text-left text-xs font-medium text-[--color-text-muted]">状态</th>
                  <th className="w-[70px] px-4 py-2.5 text-left text-xs font-medium text-[--color-text-muted]">BASE</th>
                  <th className="w-[90px] px-4 py-2.5 text-left text-xs font-medium text-[--color-text-muted]">联系人</th>
                  <th className="w-[70px] px-4 py-2.5 text-left font-mono text-xs font-medium text-[--color-text-muted]">面试</th>
                  <th className="w-[60px] px-4 py-2.5 text-left text-xs font-medium text-[--color-text-muted]">链接</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-[--color-text-muted]">备注</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr key={job.id} className="border-b border-[--color-border] last:border-b-0">
                    <td className="px-4 py-3 font-medium">{job.company}</td>
                    <td className="px-4 py-3 text-[--color-text-secondary]">{job.position}</td>
                    <td className="px-4 py-3 font-mono text-xs text-[--color-text-muted]">{job.channel}</td>
                    <td className="px-4 py-3 font-mono text-xs text-[--color-text-muted]">
                      {formatChinaDate(job.appliedAt, { month: "2-digit", day: "2-digit" })}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={job.status} type="job" /></td>
                    <td className="px-4 py-3 text-xs text-[--color-text-muted]">{job.baseLocation || "—"}</td>
                    <td className="max-w-[110px] truncate px-4 py-3 text-xs text-[--color-text-muted]">{job.hrContact || "—"}</td>
                    <td className="px-4 py-3 text-center font-mono text-xs text-[--color-text-muted]">{job._count.interviews}</td>
                    <td className="px-4 py-3">
                      {job.link ? (
                        <a href={job.link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-0.5 text-xs text-[--color-link] hover:underline">
                          投递 <ExternalLink size={10} />
                        </a>
                      ) : (
                        <span className="text-xs text-[--color-text-muted]">—</span>
                      )}
                    </td>
                    <td className="max-w-[220px] px-4 py-3 text-xs text-[--color-text-muted]">{job.notes || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {jobs.length > 0 && <p className="mt-2 font-mono text-xs text-[--color-text-muted]">{jobs.length} 条记录</p>}
    </div>
  )
}
