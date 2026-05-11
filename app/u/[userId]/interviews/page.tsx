import { CalendarClock, Star } from "lucide-react"
import { notFound } from "next/navigation"

import { SimpleBarChart } from "@/components/charts/bar-chart"
import { SimplePieChart } from "@/components/charts/pie-chart"
import { EmptyState } from "@/components/empty-state"
import { FriendModuleNav } from "@/components/friend-module-nav"
import { ModuleHero, ModulePageShell, ModulePanel, ModuleTableShell } from "@/components/module/module-shell"
import { StatsCard } from "@/components/stats-card"
import { StatusBadge } from "@/components/status-badge"
import { getOptionalSession } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { INTERVIEW_RESULTS } from "@/lib/enums"
import { getFriendVisibleModules } from "@/lib/friend-module-nav"
import { canViewModule, getAccessLevel, recordVisit } from "@/lib/permissions"
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
  if (!value) return <span className="text-xs text-slate-400">-</span>
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, index) => (
        <Star
          key={index}
          size={12}
          className={value > index ? "text-amber-400" : "text-slate-200"}
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
    <ModulePageShell maxWidth="full">
      <FriendModuleNav ownerId={ownerId} displayName={displayName} current="interviews" modules={visibleModules} />
      <ModuleHero
        icon={CalendarClock}
        title="Interview records"
        description="Visible interview rounds, notes, outcomes, and review details."
        stats={[
          { label: "Interviews", value: String(stats.total) },
          { label: "Pass rate", value: `${stats.passRate}%` },
          { label: "Passed", value: String(stats.passed) },
          { label: "Pending", value: String(stats.pending) },
        ]}
      />

      <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 lg:grid-cols-4">
        <StatsCard title="Total" value={stats.total} unit="rounds" />
        <StatsCard title="Pass rate" value={`${stats.passRate}%`} trend={stats.passRate > 60 ? "up" : "neutral"} />
        <StatsCard title="Passed" value={stats.passed} unit="rounds" trend="up" />
        <StatsCard title="Failed" value={stats.failed} unit="rounds" trend={stats.failed > 0 ? "down" : "neutral"} />
      </div>

      {stats.total > 0 ? (
        <div className="grid gap-4 md:grid-cols-3">
          <ModulePanel title="By format" contentClassName="p-5">
            <SimplePieChart data={stats.formatDist} height={180} />
          </ModulePanel>
          <ModulePanel title="By round" contentClassName="p-5">
            <SimpleBarChart data={stats.roundDist} height={180} />
          </ModulePanel>
          {stats.companyDist.length > 0 ? (
            <ModulePanel title="By company" contentClassName="p-5">
              <SimpleBarChart data={stats.companyDist} height={180} />
            </ModulePanel>
          ) : null}
        </div>
      ) : null}

      <ModulePanel title="Interview timeline" description={`${interviews.length} visible records`} contentClassName="p-0">
        {interviews.length === 0 ? (
          <div className="p-6">
            <EmptyState title="No interview records" description="Visible interview progress will appear here." />
          </div>
        ) : (
          <>
            <div className="hidden md:block">
              <ModuleTableShell>
                <table className="w-full min-w-[1080px] text-sm">
                  <thead className="sticky top-0 z-10 bg-slate-50">
                    <tr className="border-b border-slate-200">
                      {["Company", "Position", "Round", "Format", "Date", "Interviewers", "Rating", "Result", "Questions / Feedback"].map((head) => (
                        <th key={head} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">{head}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {interviews.map((item) => (
                      <tr key={item.id} className="align-top transition hover:bg-blue-50/40">
                        <td className="px-4 py-3 font-semibold text-slate-900">{item.company}</td>
                        <td className="px-4 py-3 text-slate-600">{item.position}</td>
                        <td className="px-4 py-3 text-xs text-slate-500">{item.round}</td>
                        <td className="px-4 py-3 text-xs text-slate-500">{item.format}</td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-500" title={formatChinaDateTime(item.scheduledAt)}>
                          {formatChinaDate(item.scheduledAt)}
                        </td>
                        <td className="max-w-[140px] px-4 py-3 text-xs text-slate-500">{item.interviewers || "-"}</td>
                        <td className="px-4 py-3"><RatingStars value={item.selfRating} /></td>
                        <td className="px-4 py-3"><StatusBadge status={item.result} type="interview" /></td>
                        <td className="max-w-[360px] px-4 py-3 text-xs text-slate-500">
                          {item.questions ? <div className="mb-2 whitespace-pre-wrap rounded-[14px] bg-slate-50 p-2 font-mono">{item.questions}</div> : null}
                          {item.feedback ? <p className="whitespace-pre-wrap">{item.feedback}</p> : !item.questions ? "-" : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ModuleTableShell>
            </div>

            <div className="grid gap-3 p-4 md:hidden">
              {interviews.map((item) => (
                <article key={item.id} className="rounded-[18px] border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate font-semibold text-slate-950">{item.company}</h3>
                      <p className="mt-1 text-sm text-slate-500">{item.position}</p>
                    </div>
                    <StatusBadge status={item.result} type="interview" />
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-500">
                    <span>{item.round}</span>
                    <span>{item.format}</span>
                    <span>{formatChinaDate(item.scheduledAt)}</span>
                    <RatingStars value={item.selfRating} />
                  </div>
                  {item.feedback ? <p className="mt-3 text-sm leading-6 text-slate-600">{item.feedback}</p> : null}
                </article>
              ))}
            </div>
          </>
        )}
      </ModulePanel>
    </ModulePageShell>
  )
}
