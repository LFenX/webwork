import "server-only"

import { prisma } from "@/lib/db"

export type SqlFewShot = {
  title: string
  user: string
  sql: string
}

const ANCHORS: SqlFewShot[] = [
  {
    title: "最近 30 天聚合",
    user: "最近一个月各阶段数量",
    sql: `SELECT "status", COUNT(*) AS cnt
FROM "JobApplication"
WHERE "appliedAt" >= NOW() - INTERVAL '30 days'
GROUP BY "status"
ORDER BY cnt DESC;`,
  },
  {
    title: "时间趋势",
    user: "按天看最近一周新增文章",
    sql: `SELECT DATE_TRUNC('day', "createdAt") AS day, COUNT(*) AS cnt
FROM "Post"
WHERE "createdAt" >= NOW() - INTERVAL '7 days'
GROUP BY day
ORDER BY day;`,
  },
  {
    title: "用户关联",
    user: "列出最近活跃用户及邮箱",
    sql: `SELECT u."displayName", u."email", s."lastActiveAt"
FROM "UserSession" s
JOIN "User" u ON u."id" = s."userId"
ORDER BY s."lastActiveAt" DESC
LIMIT 50;`,
  },
  {
    title: "转化率",
    user: "面试到 offer 的转化情况",
    sql: `SELECT
  COUNT(*) FILTER (WHERE "status" = 'interview') AS interview_count,
  COUNT(*) FILTER (WHERE "status" = 'offer') AS offer_count,
  ROUND(COUNT(*) FILTER (WHERE "status" = 'offer')::numeric / NULLIF(COUNT(*) FILTER (WHERE "status" = 'interview'), 0), 4) AS offer_rate
FROM "JobApplication";`,
  },
  {
    title: "错误排查",
    user: "最近失败的 SQL 查询",
    sql: `SELECT "startedAt", "durationMs", "errorCode", "errorMessage"
FROM "SqlAuditLog"
WHERE ok = false
ORDER BY "startedAt" DESC
LIMIT 30;`,
  },
]

function terms(text: string) {
  return text.toLowerCase().match(/[a-z0-9_]+|[\u4e00-\u9fff]{2,}/g) ?? []
}

function scoreShot(prompt: string, shot: SqlFewShot) {
  const q = terms(prompt)
  const hay = `${shot.title}\n${shot.user}\n${shot.sql}`.toLowerCase()
  return q.reduce((sum, term) => sum + (hay.includes(term) ? 1 : 0), 0)
}

export async function selectFewShots(input: { userId: string; prompt: string; limit?: number }): Promise<SqlFewShot[]> {
  const limit = input.limit ?? 3
  const dynamicRows = await prisma.$queryRaw<Array<{ sqlPreview: string; touchedTables: string[] }>>`
    SELECT "sqlPreview", "touchedTables"
    FROM "SqlAuditLog"
    WHERE "userId" = ${input.userId}
      AND ok = true
      AND "rowCount" > 0
      AND "durationMs" < 5000
    ORDER BY "startedAt" DESC
    LIMIT 12
  `.catch(() => [])

  const dynamicShots: SqlFewShot[] = dynamicRows.map((row, index) => ({
    title: `历史成功查询 ${index + 1}`,
    user: row.touchedTables.length ? `围绕 ${row.touchedTables.join("、")} 的成功查询` : "历史成功 SQL",
    sql: row.sqlPreview,
  }))

  return [...ANCHORS, ...dynamicShots]
    .map((shot) => ({ shot, score: scoreShot(input.prompt, shot) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => item.shot)
}
