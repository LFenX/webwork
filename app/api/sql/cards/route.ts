import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { analyzeSql, jsonError } from "@/lib/sql-lab/service"
import type { SqlInsightCard } from "@/lib/sql-lab/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const NO_STORE = { "Cache-Control": "no-store" } as const

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

export async function GET() {
  try {
    const session = await requireAuth()
    const rows = await prisma.$queryRaw<CardRow[]>`
      SELECT id, title, description, sql, "chartConfig", "snapshotJson", layout, "refreshMeta", theme, pinned, shared, "threadId", "createdAt", "updatedAt"
      FROM "SqlInsightCard"
      WHERE "userId" = ${session.userId}
      ORDER BY pinned DESC, "updatedAt" DESC
      LIMIT 80
    `
    return NextResponse.json({ items: rows.map(asCard) }, { headers: NO_STORE })
  } catch (error) {
    return jsonError(error)
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth()
    const body = (await req.json().catch(() => ({}))) as {
      title?: string
      description?: string
      sql?: string
      chartConfig?: unknown
      snapshotJson?: unknown
      layout?: unknown
      refreshMeta?: unknown
      theme?: string
      threadId?: string | null
      pinned?: boolean
      shared?: boolean
    }
    const sql = body.sql?.trim() ?? ""
    if (!sql) return NextResponse.json({ error: "SQL 不能为空" }, { status: 400, headers: NO_STORE })
    analyzeSql(sql)
    const title = body.title?.trim() || "SQL 分析卡片"
    const description = body.description?.trim() || ""
    const theme = body.theme === "dark" || body.theme === "light" ? body.theme : "report"
    const rows = await prisma.$queryRaw<CardRow[]>`
      INSERT INTO "SqlInsightCard" (id, "userId", "threadId", title, description, sql, "chartConfig", "snapshotJson", layout, "refreshMeta", theme, pinned, shared, "createdAt", "updatedAt")
      VALUES (
        ${crypto.randomUUID()}, ${session.userId}, ${body.threadId ?? null}, ${title}, ${description}, ${sql},
        ${body.chartConfig ?? {}}, ${body.snapshotJson ?? null}, ${body.layout ?? null}, ${body.refreshMeta ?? null}, ${theme},
        ${Boolean(body.pinned)}, ${Boolean(body.shared)}, now(), now()
      )
      RETURNING id, title, description, sql, "chartConfig", "snapshotJson", layout, "refreshMeta", theme, pinned, shared, "threadId", "createdAt", "updatedAt"
    `
    return NextResponse.json(asCard(rows[0]), { headers: NO_STORE })
  } catch (error) {
    return jsonError(error)
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await requireAuth()
    const body = (await req.json().catch(() => ({}))) as Partial<SqlInsightCard> & { id?: string }
    if (!body.id) return NextResponse.json({ error: "缺少 id" }, { status: 400, headers: NO_STORE })
    const rows = await prisma.$queryRaw<CardRow[]>`
      UPDATE "SqlInsightCard"
      SET
        title = COALESCE(${body.title ?? null}, title),
        description = COALESCE(${body.description ?? null}, description),
        pinned = COALESCE(${typeof body.pinned === "boolean" ? body.pinned : null}, pinned),
        shared = COALESCE(${typeof body.shared === "boolean" ? body.shared : null}, shared),
        "chartConfig" = COALESCE(${body.chartConfig ?? null}, "chartConfig"),
        "snapshotJson" = COALESCE(${body.snapshotJson ?? null}, "snapshotJson"),
        layout = COALESCE(${body.layout ?? null}, layout),
        "refreshMeta" = COALESCE(${body.refreshMeta ?? null}, "refreshMeta"),
        theme = COALESCE(${body.theme ?? null}, theme),
        "updatedAt" = now()
      WHERE id = ${body.id}
        AND "userId" = ${session.userId}
      RETURNING id, title, description, sql, "chartConfig", "snapshotJson", layout, "refreshMeta", theme, pinned, shared, "threadId", "createdAt", "updatedAt"
    `
    if (!rows[0]) return NextResponse.json({ error: "卡片不存在" }, { status: 404, headers: NO_STORE })
    return NextResponse.json(asCard(rows[0]), { headers: NO_STORE })
  } catch (error) {
    return jsonError(error)
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await requireAuth()
    const id = new URL(req.url).searchParams.get("id")
    if (!id) return NextResponse.json({ error: "缺少 id" }, { status: 400, headers: NO_STORE })
    await prisma.$executeRaw`
      DELETE FROM "SqlInsightCard"
      WHERE id = ${id}
        AND "userId" = ${session.userId}
    `
    return NextResponse.json({ ok: true }, { headers: NO_STORE })
  } catch (error) {
    return jsonError(error)
  }
}
