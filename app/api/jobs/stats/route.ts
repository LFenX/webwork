import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { format } from "date-fns"
import { getSession } from "@/lib/session"
import { JOB_PIPELINE_STAGES } from "@/lib/enums"
import { getJobReachedStage, hasJobReplySignal, JOB_INTERVIEW_STATUSES, JOB_OFFER_STATUSES, JOB_TERMINAL_STATUSES } from "@/lib/job-stats"

export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store" }

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "未登录" }, { status: 401, headers: NO_STORE })

  const jobs = await prisma.jobApplication.findMany({
    where: { userId: session.userId, archivedAt: null },
    orderBy: { appliedAt: "asc" },
  })

  const total = jobs.length
  const replied = jobs.filter(hasJobReplySignal).length
  const hasInterview = jobs.filter((j) => JOB_INTERVIEW_STATUSES.has(j.status)).length
  const offers = jobs.filter((j) => JOB_OFFER_STATUSES.has(j.status)).length

  const replyRate = total > 0 ? Math.round((replied / total) * 100) : 0
  const interviewRate = total > 0 ? Math.round((hasInterview / total) * 100) : 0
  const offerRate = total > 0 ? Math.round((offers / total) * 100) : 0

  // 新增指标
  const priorityCount = jobs.filter((j) => (j.priority ?? 0) > 0).length
  const activeCount = jobs.filter((j) => !JOB_TERMINAL_STATUSES.has(j.status)).length

  const now = new Date()
  const inSevenDays = new Date(now.getTime() + 7 * 24 * 3600 * 1000)
  const upcomingCount = jobs.filter((j) => {
    if (!j.nextActionAt) return false
    const t = new Date(j.nextActionAt).getTime()
    return t >= now.getTime() - 24 * 3600 * 1000 && t <= inSevenDays.getTime()
  }).length

  const lastApply = jobs.length > 0 ? jobs[jobs.length - 1].appliedAt : null
  const daysSinceLastApply = lastApply
    ? Math.max(0, Math.floor((now.getTime() - new Date(lastApply).getTime()) / (24 * 3600 * 1000)))
    : null

  const statusCount: Record<string, number> = {}
  jobs.forEach((j) => { statusCount[j.status] = (statusCount[j.status] ?? 0) + 1 })
  const statusDist = Object.entries(statusCount).map(([name, value]) => ({ name, value }))

  const channelCount: Record<string, number> = {}
  jobs.forEach((j) => { channelCount[j.channel] = (channelCount[j.channel] ?? 0) + 1 })
  const channelDist = Object.entries(channelCount)
    .sort(([, a], [, b]) => b - a)
    .map(([name, value]) => ({ name, value }))

  const pipelineCount = new Array(JOB_PIPELINE_STAGES.length).fill(0) as number[]
  jobs.forEach((j) => {
    const idx = Math.min(Math.max(j.pipelineStage ?? 0, 0), JOB_PIPELINE_STAGES.length - 1)
    pipelineCount[idx]++
  })
  const pipelineDist = JOB_PIPELINE_STAGES.map((name, idx) => ({ name, value: pipelineCount[idx] }))

  const reachedStages = jobs.map(getJobReachedStage)
  const funnelDist = JOB_PIPELINE_STAGES.map((name, idx) => {
    const reached = reachedStages.filter((stage) => stage >= idx).length
    const previousReached = idx === 0 ? total : reachedStages.filter((stage) => stage >= idx - 1).length
    return {
      name,
      reached,
      totalRate: total > 0 ? Math.round((reached / total) * 100) : 0,
      stepRate: idx === 0 ? 100 : previousReached > 0 ? Math.round((reached / previousReached) * 100) : 0,
      dropOff: idx === 0 ? 0 : Math.max(previousReached - reached, 0),
    }
  })

  const locationCount: Record<string, number> = {}
  jobs.forEach((j) => {
    if (!j.baseLocation) return
    locationCount[j.baseLocation] = (locationCount[j.baseLocation] ?? 0) + 1
  })
  const locationDist = Object.entries(locationCount)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8)
    .map(([name, value]) => ({ name, value }))

  const monthCount: Record<string, number> = {}
  jobs.forEach((j) => {
    const key = format(new Date(j.appliedAt), "yyyy-MM")
    monthCount[key] = (monthCount[key] ?? 0) + 1
  })
  const monthlyTrend = Object.entries(monthCount)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([name, value]) => ({ name: name.slice(5), value }))

  // 最近 8 周趋势（按 ISO 周）
  const weekMs = 7 * 24 * 3600 * 1000
  const weekBuckets: { name: string; value: number }[] = []
  for (let i = 7; i >= 0; i--) {
    const end = new Date(now.getTime() - i * weekMs)
    const start = new Date(end.getTime() - weekMs)
    const count = jobs.filter((j) => {
      const t = new Date(j.appliedAt).getTime()
      return t > start.getTime() && t <= end.getTime()
    }).length
    weekBuckets.push({ name: format(end, "MM-dd"), value: count })
  }

  return NextResponse.json(
    {
      total, replied, replyRate, hasInterview, interviewRate, offers, offerRate,
      priorityCount, activeCount, upcomingCount, daysSinceLastApply,
      statusDist, channelDist, locationDist, monthlyTrend, weeklyTrend: weekBuckets, pipelineDist, funnelDist,
    },
    { headers: NO_STORE }
  )
}
