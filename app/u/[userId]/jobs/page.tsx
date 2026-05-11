import { format } from "date-fns"
import { BriefcaseBusiness } from "lucide-react"
import { notFound } from "next/navigation"

import { FriendJobsClient } from "@/components/friend-jobs-client"
import { FriendModuleNav } from "@/components/friend-module-nav"
import { ModuleHero, ModulePageShell } from "@/components/module/module-shell"
import { getOptionalSession } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { JOB_STATUS } from "@/lib/enums"
import { getFriendVisibleModules } from "@/lib/friend-module-nav"
import { canViewModule, getAccessLevel, recordVisit } from "@/lib/permissions"

const STATUS_COLORS: Record<string, string> = {
  [JOB_STATUS[0]]: "#94a3b8",
  [JOB_STATUS[1]]: "#f59e0b",
  [JOB_STATUS[2]]: "#2563eb",
  [JOB_STATUS[3]]: "#ef4444",
  [JOB_STATUS[4]]: "#10b981",
  [JOB_STATUS[5]]: "#10b981",
  [JOB_STATUS[6]]: "#cbd5e1",
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
    monthCount.set(format(job.appliedAt, "yyyy-MM"), (monthCount.get(format(job.appliedAt, "yyyy-MM")) ?? 0) + 1)
  }

  return {
    total,
    replyRate: total > 0 ? Math.round((replied / total) * 100) : 0,
    interviewRate: total > 0 ? Math.round((hasInterview / total) * 100) : 0,
    offerRate: total > 0 ? Math.round((offers / total) * 100) : 0,
    statusDist: Array.from(statusCount.entries()).map(([name, value]) => ({
      name,
      value,
      color: STATUS_COLORS[name] ?? "#94a3b8",
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
  const visibleModules = await getFriendVisibleModules(ownerId, level)
  const stats = buildStats(jobs)
  const clientJobs = jobs.map((job) => ({
    id: job.id,
    company: job.company,
    position: job.position,
    channel: job.channel,
    appliedAt: job.appliedAt.toISOString(),
    status: job.status,
    notes: job.notes,
    baseLocation: job.baseLocation,
    hrContact: job.hrContact,
    link: job.link,
    interviewCount: job._count.interviews,
  }))

  return (
    <ModulePageShell maxWidth="full">
      <FriendModuleNav ownerId={ownerId} displayName={displayName} current="jobs" modules={visibleModules} />
      <ModuleHero
        icon={BriefcaseBusiness}
        title="Job timeline"
        description="Visible job applications, status changes, channels, and interview progress."
        stats={[
          { label: "Applications", value: String(stats.total) },
          { label: "Reply rate", value: `${stats.replyRate}%` },
          { label: "Interview rate", value: `${stats.interviewRate}%` },
          { label: "Offer rate", value: `${stats.offerRate}%` },
        ]}
      />
      <FriendJobsClient ownerId={ownerId} jobs={clientJobs} stats={stats} canImport={level === "friend"} />
    </ModulePageShell>
  )
}
