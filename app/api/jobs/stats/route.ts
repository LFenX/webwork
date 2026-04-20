import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { format } from "date-fns"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET() {
  const jobs = await prisma.jobApplication.findMany({
    orderBy: { appliedAt: "asc" },
  })

  const total = jobs.length
  const replied = jobs.filter(
    (j) => !["已投递"].includes(j.status)
  ).length
  const hasInterview = jobs.filter((j) =>
    ["进入面试", "已Offer", "已接受"].includes(j.status)
  ).length
  const offers = jobs.filter((j) =>
    ["已Offer", "已接受"].includes(j.status)
  ).length

  const replyRate = total > 0 ? Math.round((replied / total) * 100) : 0
  const interviewRate = total > 0 ? Math.round((hasInterview / total) * 100) : 0
  const offerRate = total > 0 ? Math.round((offers / total) * 100) : 0

  // Status distribution
  const statusCount: Record<string, number> = {}
  jobs.forEach((j) => {
    statusCount[j.status] = (statusCount[j.status] ?? 0) + 1
  })
  const statusDist = Object.entries(statusCount).map(([name, value]) => ({ name, value }))

  // Monthly trend
  const monthCount: Record<string, number> = {}
  jobs.forEach((j) => {
    const key = format(new Date(j.appliedAt), "yyyy-MM")
    monthCount[key] = (monthCount[key] ?? 0) + 1
  })
  const monthlyTrend = Object.entries(monthCount)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([name, value]) => ({ name: name.slice(5), value }))

  return NextResponse.json(
    {
      total,
      replied,
      replyRate,
      hasInterview,
      interviewRate,
      offers,
      offerRate,
      statusDist,
      monthlyTrend,
    },
    {
      headers: { "Cache-Control": "no-store, max-age=0" },
    }
  )
}
