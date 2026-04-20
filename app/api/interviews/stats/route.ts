import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function GET() {
  const interviews = await prisma.interviewRecord.findMany({
    orderBy: { scheduledAt: "asc" },
  })

  const total = interviews.length
  const passed = interviews.filter((i) => i.result === "通过").length
  const failed = interviews.filter((i) => i.result === "未通过").length
  const pending = interviews.filter((i) => i.result === "待定").length
  const passRate = total > 0 ? Math.round((passed / total) * 100) : 0

  // By round
  const roundCount: Record<string, number> = {}
  interviews.forEach((i) => {
    roundCount[i.round] = (roundCount[i.round] ?? 0) + 1
  })
  const roundDist = Object.entries(roundCount).map(([name, value]) => ({ name, value }))

  // By format
  const formatCount: Record<string, number> = {}
  interviews.forEach((i) => {
    formatCount[i.format] = (formatCount[i.format] ?? 0) + 1
  })
  const formatDist = Object.entries(formatCount).map(([name, value]) => ({ name, value }))

  // By company
  const companyCount: Record<string, number> = {}
  interviews.forEach((i) => {
    companyCount[i.company] = (companyCount[i.company] ?? 0) + 1
  })
  const companyDist = Object.entries(companyCount)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8)
    .map(([name, value]) => ({ name, value }))

  return NextResponse.json({
    total,
    passed,
    failed,
    pending,
    passRate,
    roundDist,
    formatDist,
    companyDist,
  })
}
