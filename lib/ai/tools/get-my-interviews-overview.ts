import "server-only"
import { prisma } from "@/lib/db"

export const getMyInterviewsOverviewTool = {
  name: "get_my_interviews_overview",
  title: "我的面试概览",
  description: "获取当前用户的面试统计和最近面试安排",
  execute: async ({ userId }: { userId: string }) => {
    const [interviews, recentInterviews] = await Promise.all([
      prisma.interviewRecord.findMany({
        where: { userId },
        orderBy: { scheduledAt: "asc" },
      }),
      prisma.interviewRecord.findMany({
        where: { userId },
        orderBy: { scheduledAt: "desc" },
        take: 8,
        select: {
          id: true,
          company: true,
          position: true,
          round: true,
          format: true,
          result: true,
          scheduledAt: true,
        },
      }),
    ])

    const total = interviews.length
    const passed = interviews.filter((item) => item.result === "通过").length
    const failed = interviews.filter((item) => item.result === "未通过").length
    const pending = interviews.filter((item) => item.result === "待定").length
    const passRate = total > 0 ? Math.round((passed / total) * 100) : 0

    const roundCount: Record<string, number> = {}
    const formatCount: Record<string, number> = {}
    const companyCount: Record<string, number> = {}

    for (const interview of interviews) {
      roundCount[interview.round] = (roundCount[interview.round] ?? 0) + 1
      formatCount[interview.format] = (formatCount[interview.format] ?? 0) + 1
      companyCount[interview.company] = (companyCount[interview.company] ?? 0) + 1
    }

    return {
      total,
      passed,
      failed,
      pending,
      passRate,
      roundDist: Object.entries(roundCount).map(([name, value]) => ({ name, value })),
      formatDist: Object.entries(formatCount).map(([name, value]) => ({ name, value })),
      companyDist: Object.entries(companyCount)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 8)
        .map(([name, value]) => ({ name, value })),
      recentInterviews: recentInterviews.map((item) => ({
        ...item,
        scheduledAt: item.scheduledAt.toISOString(),
      })),
    }
  },
}
