import "server-only"

import { Prisma } from "@/app/generated/prisma/client"
import { prisma } from "@/lib/db"

type StepRow = {
  id: string
  orderIndex: number
  title: string
  bodyMarkdown: string
  sql: string
  payload: Prisma.JsonValue | null
}

type CardRow = {
  title: string
  description: string
  sql: string
  chartConfig: Prisma.JsonValue
  updatedAt: Date
}

function previewRows(value: unknown) {
  if (!Array.isArray(value)) return "[]"
  return JSON.stringify(value.slice(0, 8))
}

export async function getThreadResultFacts(userId: string, threadId: string, limit = 3) {
  const rows = await prisma.$queryRaw<StepRow[]>`
    SELECT id, "orderIndex", title, "bodyMarkdown", sql, payload
    FROM "SqlThreadStep"
    WHERE "userId" = ${userId}
      AND "threadId" = ${threadId}
      AND kind = 'sql_run'
      AND status = 'done'
    ORDER BY "orderIndex" DESC
    LIMIT ${limit}
  `.catch(() => [])

  return rows.reverse().map((row, index) => {
    const payload = row.payload && typeof row.payload === "object" && !Array.isArray(row.payload)
      ? (row.payload as Record<string, unknown>)
      : {}
    return [
      `### 事实 ${index + 1}（来自前面第 ${row.orderIndex + 1} 步）`,
      `问题/标题：${row.title || row.bodyMarkdown || "SQL 运行结果"}`,
      `SQL：${row.sql}`,
      `结果：${previewRows(payload.sampleRows)}`,
    ].join("\n")
  })
}

export async function getPinnedInsightMemories(userId: string, limit = 5) {
  const rows = await prisma.$queryRaw<CardRow[]>`
    SELECT title, description, sql, "chartConfig", "updatedAt"
    FROM "SqlInsightCard"
    WHERE "userId" = ${userId}
      AND pinned = true
    ORDER BY "updatedAt" DESC
    LIMIT ${limit}
  `.catch(() => [])

  return rows.map((row, index) => [
    `### 置顶分析 ${index + 1}：${row.title}`,
    row.description ? `说明：${row.description}` : "",
    `SQL：${row.sql}`,
    `图表配置：${JSON.stringify(row.chartConfig)}`,
  ].filter(Boolean).join("\n"))
}
