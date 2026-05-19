import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { jsonError } from "@/lib/sql-lab/service"
import type { SqlBiDashboard, SqlInsightCard } from "@/lib/sql-lab/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const NO_STORE = { "Cache-Control": "no-store" } as const
const DASHBOARD_NAME = "默认 BI 工作台"

type DashboardRow = {
  id: string
  name: string
  theme: string
  layout: unknown | null
  createdAt: Date
  updatedAt: Date
}

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

function asDashboard(row: DashboardRow): SqlBiDashboard {
  return {
    id: row.id,
    name: row.name,
    theme: row.theme,
    layout: row.layout,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function asCard(row: CardRow): SqlInsightCard {
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

async function ensureDashboard(userId: string) {
  const rows = await prisma.$queryRaw<DashboardRow[]>`
    INSERT INTO "SqlBiDashboard" (id, "userId", name, theme, layout, "createdAt", "updatedAt")
    VALUES (${crypto.randomUUID()}, ${userId}, ${DASHBOARD_NAME}, 'report', ${[]}, now(), now())
    ON CONFLICT ("userId", name)
    DO UPDATE SET "updatedAt" = "SqlBiDashboard"."updatedAt"
    RETURNING id, name, theme, layout, "createdAt", "updatedAt"
  `
  return rows[0]
}

async function listCards(userId: string) {
  const rows = await prisma.$queryRaw<CardRow[]>`
    SELECT id, title, description, sql, "chartConfig", "snapshotJson", layout, "refreshMeta", theme, pinned, shared, "threadId", "createdAt", "updatedAt"
    FROM "SqlInsightCard"
    WHERE "userId" = ${userId}
    ORDER BY pinned DESC, "updatedAt" DESC
    LIMIT 120
  `
  return rows.map(asCard)
}

export async function GET() {
  try {
    const session = await requireAuth()
    const dashboard = await ensureDashboard(session.userId)
    const cards = await listCards(session.userId)
    return NextResponse.json({ dashboard: asDashboard(dashboard), cards }, { headers: NO_STORE })
  } catch (error) {
    return jsonError(error)
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await requireAuth()
    const body = await req.json().catch(() => ({})) as { theme?: string; layout?: unknown }
    const theme = body.theme === "dark" || body.theme === "light" ? body.theme : body.theme === "report" ? "report" : undefined
    const layout = Array.isArray(body.layout) ? body.layout : undefined
    await ensureDashboard(session.userId)
    const rows = await prisma.$queryRaw<DashboardRow[]>`
      UPDATE "SqlBiDashboard"
      SET
        theme = COALESCE(${theme ?? null}, theme),
        layout = COALESCE(${layout ?? null}, layout),
        "updatedAt" = now()
      WHERE "userId" = ${session.userId}
        AND name = ${DASHBOARD_NAME}
      RETURNING id, name, theme, layout, "createdAt", "updatedAt"
    `
    return NextResponse.json({ dashboard: asDashboard(rows[0]), cards: await listCards(session.userId) }, { headers: NO_STORE })
  } catch (error) {
    return jsonError(error)
  }
}
