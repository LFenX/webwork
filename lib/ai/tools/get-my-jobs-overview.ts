import "server-only"
import { format } from "date-fns"
import { prisma } from "@/lib/db"
import { hasJobReplySignal, JOB_INTERVIEW_STATUSES, JOB_OFFER_STATUSES } from "@/lib/job-stats"

export const getMyJobsOverviewTool = {
  name: "get_my_jobs_overview",
  title: "我的求职概览",
  description: "获取当前用户的求职列表与基础统计概览",
  execute: async ({ userId }: { userId: string }) => {
    const [jobs, recentJobs] = await Promise.all([
      prisma.jobApplication.findMany({
        where: { userId },
        orderBy: { appliedAt: "asc" },
      }),
      prisma.jobApplication.findMany({
        where: { userId },
        orderBy: { appliedAt: "desc" },
        take: 10,
        select: {
          id: true,
          company: true,
          position: true,
          status: true,
          channel: true,
          appliedAt: true,
        },
      }),
    ])

    const total = jobs.length
    const replied = jobs.filter(hasJobReplySignal).length
    const hasInterview = jobs.filter((job) => JOB_INTERVIEW_STATUSES.has(job.status)).length
    const offers = jobs.filter((job) => JOB_OFFER_STATUSES.has(job.status)).length
    const replyRate = total > 0 ? Math.round((replied / total) * 100) : 0
    const interviewRate = total > 0 ? Math.round((hasInterview / total) * 100) : 0
    const offerRate = total > 0 ? Math.round((offers / total) * 100) : 0

    const statusCount: Record<string, number> = {}
    const channelCount: Record<string, number> = {}
    const monthCount: Record<string, number> = {}

    for (const job of jobs) {
      statusCount[job.status] = (statusCount[job.status] ?? 0) + 1
      channelCount[job.channel] = (channelCount[job.channel] ?? 0) + 1
      const monthKey = format(new Date(job.appliedAt), "yyyy-MM")
      monthCount[monthKey] = (monthCount[monthKey] ?? 0) + 1
    }

    return {
      total,
      replied,
      replyRate,
      hasInterview,
      interviewRate,
      offers,
      offerRate,
      statusDist: Object.entries(statusCount).map(([name, value]) => ({ name, value })),
      channelDist: Object.entries(channelCount)
        .sort(([, a], [, b]) => b - a)
        .map(([name, value]) => ({ name, value })),
      monthlyTrend: Object.entries(monthCount)
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .map(([name, value]) => ({ name: name.slice(5), value })),
      recentJobs: recentJobs.map((job) => ({
        ...job,
        appliedAt: job.appliedAt.toISOString(),
      })),
    }
  },
}
