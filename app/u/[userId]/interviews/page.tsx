import { Star } from "lucide-react"
import { notFound } from "next/navigation"
import { SimpleBarChart } from "@/components/charts/bar-chart"
import { SimplePieChart } from "@/components/charts/pie-chart"
import { StatsCard } from "@/components/stats-card"
import { StatusBadge } from "@/components/status-badge"
import { FriendModuleNav } from "@/components/friend-module-nav"
import { prisma } from "@/lib/db"
import { getOptionalSession } from "@/lib/auth"
import { canViewModule, getAccessLevel, recordVisit } from "@/lib/permissions"
import { getFriendVisibleModules } from "@/lib/friend-module-nav"
import { INTERVIEW_RESULTS } from "@/lib/enums"
import { formatChinaDate, formatChinaDateTime } from "@/lib/time"

function countBy<T>(items: T[], getter: (item: T) => string) {
  const count = new Map<string, number>()
  for (const item of items) {
    const key = getter(item)
    count.set(key, (count.get(key) ?? 0) + 1)
  }
  return Array.from(count.entries()).map(([name, value]) => ({ name, value }))
}

function buildStats(interviews: Array<{ result: string; round: string; format: string; company: string }>) {
  const total = interviews.length
  const passed = interviews.filter((item) => item.result === INTERVIEW_RESULTS[1]).length
  const failed = interviews.filter((item) => item.result === INTERVIEW_RESULTS[2]).length
  const pending = interviews.filter((item) => item.result === INTERVIEW_RESULTS[0]).length

  return {
    total,
    passed,
    failed,
    pending,
    passRate: total > 0 ? Math.round((passed / total) * 100) : 0,
    roundDist: countBy(interviews, (item) => item.round),
    formatDist: countBy(interviews, (item) => item.format),
    companyDist: countBy(interviews, (item) => item.company)
      .sort((a, b) => b.value - a.value)
      .slice(0, 8),
  }
}

function RatingStars({ value }: { value?: number | null }) {
  if (!value) return <span className="text-xs text-[--color-text-muted]">—</span>
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, index) => (
        <Star
          key={index}
          size={12}
          className={value > index ? "text-[--color-warning]" : "text-[--color-border-strong]"}
          fill={value > index ? "currentColor" : "none"}
        />
      ))}
    </div>
  )
}

export default async function UserInterviewsPage({ params }: { params: Promise<{ userId: string }> }) {
  const [{ userId: ownerId }, session] = await Promise.all([params, getOptionalSession()])
  const owner = await prisma.user.findUnique({
    where: { id: ownerId },
    select: { displayName: true, email: true },
  })
  if (!owner) notFound()

  const level = await getAccessLevel(session?.userId ?? null, ownerId)
  if (level === "none") notFound()

  const moduleVisible = await canViewModule(ownerId, "interviews", level)
  const interviews = moduleVisible
    ? await prisma.interviewRecord.findMany({
        where: { userId: ownerId },
        orderBy: { scheduledAt: "desc" },
        include: { job: { select: { company: true, position: true } } },
      })
    : []

  await recordVisit({ ownerId, visitorId: session?.userId ?? null, module: "interviews", path: `/u/${ownerId}/interviews` })

  const displayName = owner.displayName || owner.email
  const visibleModules = await getFriendVisibleModules(ownerId, level)
  const stats = buildStats(interviews)

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-10">
      <FriendModuleNav ownerId={ownerId} displayName={displayName} current="interviews" modules={visibleModules} />
      <div className="mb-8">
        <h1 className="mb-1 text-xl font-semibold">面试记录</h1>
        <p className="text-sm text-[--color-text-muted]">记录每一轮面试，复盘提升</p>
      </div>

      <section className="mb-8">
        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatsCard title="面试总计" value={stats.total} sub="轮" />
          <StatsCard title="通过率" value={`${stats.passRate}%`} trend={stats.passRate > 60 ? "up" : "neutral"} />
          <StatsCard title="已通过" value={stats.passed} sub="轮" trend="up" />
          <StatsCard title="未通过" value={stats.failed} sub="轮" trend={stats.failed > 0 ? "down" : "neutral"} />
        </div>

        {stats.total > 0 && (
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface] p-4">
              <p className="mb-3 text-xs text-[--color-text-muted]">按形式分布</p>
              <SimplePieChart data={stats.formatDist} height={180} />
            </div>
            <div className="rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface] p-4">
              <p className="mb-3 text-xs text-[--color-text-muted]">按轮次分布</p>
              <SimpleBarChart data={stats.roundDist} height={180} />
            </div>
            {stats.companyDist.length > 0 && (
              <div className="rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface] p-4">
                <p className="mb-3 text-xs text-[--color-text-muted]">按公司面试次数</p>
                <SimpleBarChart data={stats.companyDist} height={180} />
              </div>
            )}
          </div>
        )}
      </section>

      <p className="mb-4 font-mono text-xs text-[--color-text-muted]">{interviews.length} 条记录</p>

      <div className="overflow-hidden rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface]">
        {interviews.length === 0 ? (
          <div className="py-16 text-center text-sm text-[--color-text-muted]">暂无面试记录。</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-[--color-border-strong] bg-[--color-bg-hover]">
                  <th className="w-[110px] px-4 py-2.5 text-left text-xs font-medium text-[--color-text-muted]">公司</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-[--color-text-muted]">职位</th>
                  <th className="w-[90px] px-4 py-2.5 text-left text-xs font-medium text-[--color-text-muted]">轮次</th>
                  <th className="w-[70px] px-4 py-2.5 text-left text-xs font-medium text-[--color-text-muted]">形式</th>
                  <th className="w-[120px] px-4 py-2.5 text-left font-mono text-xs font-medium text-[--color-text-muted]">日期</th>
                  <th className="w-[90px] px-4 py-2.5 text-left text-xs font-medium text-[--color-text-muted]">面试官</th>
                  <th className="w-[70px] px-4 py-2.5 text-left text-xs font-medium text-[--color-text-muted]">自评</th>
                  <th className="w-[80px] px-4 py-2.5 text-left text-xs font-medium text-[--color-text-muted]">结果</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-[--color-text-muted]">题目 / 反馈</th>
                </tr>
              </thead>
              <tbody>
                {interviews.map((item) => (
                  <tr key={item.id} className="border-b border-[--color-border] align-top last:border-b-0">
                    <td className="px-4 py-3 font-medium">{item.company}</td>
                    <td className="px-4 py-3 text-[--color-text-secondary]">{item.position}</td>
                    <td className="px-4 py-3 font-mono text-xs text-[--color-text-muted]">{item.round}</td>
                    <td className="px-4 py-3 text-xs text-[--color-text-muted]">{item.format}</td>
                    <td className="px-4 py-3 font-mono text-xs text-[--color-text-muted]" title={formatChinaDateTime(item.scheduledAt)}>
                      {formatChinaDate(item.scheduledAt)}
                    </td>
                    <td className="max-w-[120px] px-4 py-3 text-xs text-[--color-text-muted]">{item.interviewers || "—"}</td>
                    <td className="px-4 py-3"><RatingStars value={item.selfRating} /></td>
                    <td className="px-4 py-3"><StatusBadge status={item.result} type="interview" /></td>
                    <td className="max-w-[360px] px-4 py-3 text-xs text-[--color-text-muted]">
                      {item.questions && (
                        <div className="mb-2 whitespace-pre-wrap rounded border border-[--color-border] bg-[--color-bg-hover] p-2 font-mono">
                          {item.questions}
                        </div>
                      )}
                      {item.feedback ? <p className="whitespace-pre-wrap">{item.feedback}</p> : !item.questions ? "—" : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
