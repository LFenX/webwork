import { format } from "date-fns"
import { BriefcaseBusiness } from "lucide-react"
import { notFound } from "next/navigation"

import { FriendJobsClient } from "@/components/friend-jobs-client"
import { FriendModuleNav } from "@/components/friend-module-nav"
import { ModuleHero, ModulePageShell } from "@/components/module/module-shell"
import { getOptionalSession } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { getFriendVisibleModules } from "@/lib/friend-module-nav"
import { hasJobReplySignal, JOB_INTERVIEW_STATUSES, JOB_OFFER_STATUSES } from "@/lib/job-stats"
import { canViewModule, getAccessLevel, recordVisit } from "@/lib/permissions"
import { resolveCreatorProfileRef } from "@/lib/profile"
import { getPublicModuleMetadata } from "@/lib/public-page-metadata"

const STATUS_COLORS: Record<string, string> = {
  已投递: "#94a3b8",
  已回复: "#f59e0b",
  未通过评估: "#ef4444",
  进入面试: "#2563eb",
  未通过面试: "#ef4444",
  已拒绝: "#ef4444",
  已Offer: "#10b981",
  已接受: "#10b981",
  无回复放弃: "#cbd5e1",
  已放弃: "#cbd5e1",
}

function buildStats(jobs: Array<{ status: string; channel: string; appliedAt: Date; repliedAt?: Date | null; pipelineStage?: number | null }>) {
  const total = jobs.length
  const replied = jobs.filter(hasJobReplySignal).length
  const hasInterview = jobs.filter((job) => JOB_INTERVIEW_STATUSES.has(job.status)).length
  const offers = jobs.filter((job) => JOB_OFFER_STATUSES.has(job.status)).length

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

export function generateMetadata({ params }: { params: Promise<{ userId: string }> }) {
  return params.then(({ userId }) => getPublicModuleMetadata(userId, "jobs", "求职", "公开求职进展。"))
}

export default async function UserJobsPage({ params }: { params: Promise<{ userId: string }> }) {
  const [{ userId: ownerRef }, session] = await Promise.all([params, getOptionalSession()])
  const owner = await resolveCreatorProfileRef(ownerRef)
  if (!owner) notFound()
  const ownerId = owner.id

  const level = await getAccessLevel(session?.userId ?? null, ownerId)

  const moduleVisible = await canViewModule(ownerId, "jobs", level)
  if (level === "public" && !moduleVisible) notFound()
  const jobs = moduleVisible
    ? await prisma.jobApplication.findMany({
        where: { userId: ownerId, archivedAt: null },
        orderBy: [{ priority: "desc" }, { appliedAt: "desc" }],
        include: { _count: { select: { interviews: true } } },
      })
    : []

  await recordVisit({ ownerId, visitorId: session?.userId ?? null, module: "jobs", path: `/u/${owner.publicRef}/jobs` })

  const displayName = owner.displayName || (level === "public" ? "公开用户" : owner.email)
  const visibleModules = await getFriendVisibleModules(ownerId, level)
  const stats = buildStats(jobs)
  const clientJobs = jobs.map((job) => ({
    id: job.id,
    company: job.company,
    position: job.position,
    channel: job.channel,
    appliedAt: job.appliedAt.toISOString(),
    status: job.status,
    notes: level === "public" ? null : job.notes,
    baseLocation: job.baseLocation,
    hrContact: level === "public" ? null : job.hrContact,
    link: job.link,
    interviewCount: job._count.interviews,
  }))

  return (
    <ModulePageShell maxWidth="full">
      <FriendModuleNav ownerId={ownerId} ownerRef={owner.publicRef} displayName={displayName} current="jobs" modules={visibleModules} />
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
