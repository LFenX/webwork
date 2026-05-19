import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { executeSql, jsonError } from "@/lib/sql-lab/service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const NO_STORE = { "Cache-Control": "no-store" } as const
const SNAPSHOT_ROW_LIMIT = 2000

type CardRow = {
  id: string
  title: string
  description: string
  sql: string
  chartConfig: unknown
  snapshotJson: unknown | null
  layout: unknown | null
  refreshMeta: unknown | null
  theme: string
  pinned: boolean
  shared: boolean
  threadId: string | null
  createdAt: Date
  updatedAt: Date
}

function asCard(row: CardRow) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    sql: row.sql,
    chartConfig: row.chartConfig,
    snapshotJson: row.snapshotJson,
    layout: row.layout,
    refreshMeta: row.refreshMeta,
    theme: row.theme,
    pinned: row.pinned,
    shared: row.shared,
    threadId: row.threadId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth()
    const { id } = await ctx.params
    const rows = await prisma.$queryRaw<CardRow[]>`
      SELECT id, title, description, sql, "chartConfig", "snapshotJson", layout, "refreshMeta", theme, pinned, shared, "threadId", "createdAt", "updatedAt"
      FROM "SqlInsightCard"
      WHERE id = ${id}
        AND "userId" = ${session.userId}
      LIMIT 1
    `
    const card = rows[0]
    if (!card) return NextResponse.json({ error: "卡片不存在" }, { status: 404, headers: NO_STORE })

    const result = await executeSql(session.userId, {
      sql: card.sql,
      limit: SNAPSHOT_ROW_LIMIT,
      forceReadOnly: true,
    }, {
      threadId: card.threadId ?? undefined,
      aiInitiated: false,
      probePurpose: "刷新 BI 图表卡片",
      timeoutMs: 30_000,
    })
    if (!result.ok) {
      return NextResponse.json({ error: result.error?.message ?? "刷新失败", result }, { status: 400, headers: NO_STORE })
    }

    const last = result.resultSets[result.resultSets.length - 1]
    const snapshot = {
      columns: last?.columns ?? [],
      rows: (last?.rows ?? []).slice(0, SNAPSHOT_ROW_LIMIT),
      rowCount: last?.rowCount ?? 0,
      truncated: Boolean(last?.truncated),
      generatedAt: new Date().toISOString(),
    }
    const refreshMeta = {
      refreshedAt: snapshot.generatedAt,
      durationMs: result.durationMs,
      rowCount: snapshot.rowCount,
      warnings: result.warnings,
    }
    const updated = await prisma.$queryRaw<CardRow[]>`
      UPDATE "SqlInsightCard"
      SET "snapshotJson" = ${snapshot},
          "refreshMeta" = ${refreshMeta},
          "updatedAt" = now()
      WHERE id = ${id}
        AND "userId" = ${session.userId}
      RETURNING id, title, description, sql, "chartConfig", "snapshotJson", layout, "refreshMeta", theme, pinned, shared, "threadId", "createdAt", "updatedAt"
    `
    return NextResponse.json(asCard(updated[0]), { headers: NO_STORE })
  } catch (error) {
    return jsonError(error)
  }
}
