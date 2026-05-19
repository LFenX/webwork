import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { requestProviderChat, type ProviderMessage } from "@/lib/ai/provider"
import { getEffectiveProviderConfig } from "@/lib/ai/service"
import { TOOL_RUN_SAFE_SQL } from "@/lib/sql-lab/ai/tools"
import { executeSafeProbe, jsonError } from "@/lib/sql-lab/service"
import { inferColumnRoles, suggestChartConfigs } from "@/lib/sql-lab/visualization/auto-chart"
import { normalizeChartConfig, type ChartConfig, type ChartSnapshot } from "@/lib/sql-lab/visualization/chart-config"
import type { SqlRunColumn } from "@/lib/sql-lab/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const NO_STORE = { "Cache-Control": "no-store" } as const
const SNAPSHOT_ROW_LIMIT = 2000

type SuggestBody = {
  sql?: string
  threadId?: string | null
  columns?: SqlRunColumn[]
  rows?: Array<Record<string, unknown>>
  count?: number
}

type SuggestedCard = {
  title: string
  description: string
  chartConfig: ChartConfig
  sourceSql?: string
  snapshot?: ChartSnapshot
  rationale?: string
  confidence?: number
}

function clampCount(value: unknown) {
  const n = Number(value)
  if (n === 2 || n === 4 || n === 6 || n === 8) return n
  return 4
}

function makeSnapshot(columns: SqlRunColumn[], rows: Array<Record<string, unknown>>): ChartSnapshot {
  return {
    columns,
    rows: rows.slice(0, SNAPSHOT_ROW_LIMIT),
    rowCount: rows.length,
    truncated: rows.length > SNAPSHOT_ROW_LIMIT,
    generatedAt: new Date().toISOString(),
  }
}

function fallbackCards(input: { columns: SqlRunColumn[]; rows: Array<Record<string, unknown>>; sql: string; count: number }): SuggestedCard[] {
  const snapshot = makeSnapshot(input.columns, input.rows)
  return suggestChartConfigs(input.columns, input.rows, input.count).map((config, index) => ({
    title: config.title || `推荐图表 ${index + 1}`,
    description: config.description || "基于当前结果集自动生成",
    chartConfig: normalizeChartConfig(config, input.columns),
    sourceSql: input.sql,
    snapshot,
    rationale: "本地规则根据字段类型、基数和指标列生成。",
    confidence: 0.62,
  }))
}

function extractJson<T extends object>(text: string, fallback: T): T {
  const trimmed = text.trim()
  const candidates = [
    trimmed,
    trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] ?? "",
    trimmed.match(/\{[\s\S]*\}/)?.[0] ?? "",
  ].filter(Boolean)
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as T
      if (parsed && typeof parsed === "object") return parsed
    } catch {}
  }
  return fallback
}

function compactRows(rows: Array<Record<string, unknown>>) {
  return rows.slice(0, 50).map((row) => {
    const entries = Object.entries(row).slice(0, 16)
    return Object.fromEntries(entries)
  })
}

function normalizeCards(rawCards: unknown, fallback: SuggestedCard[], columns: SqlRunColumn[], sql: string, rows: Array<Record<string, unknown>>) {
  if (!Array.isArray(rawCards)) return fallback
  const currentSnapshot = makeSnapshot(columns, rows)
  const cards = rawCards
    .map((item, index): SuggestedCard | null => {
      if (!item || typeof item !== "object") return null
      const raw = item as Record<string, unknown>
      const config = normalizeChartConfig(raw.chartConfig, columns)
      return {
        title: typeof raw.title === "string" && raw.title.trim() ? raw.title.trim().slice(0, 80) : config.title || `推荐图表 ${index + 1}`,
        description: typeof raw.description === "string" ? raw.description.trim().slice(0, 180) : config.description || "",
        chartConfig: {
          ...config,
          title: typeof raw.title === "string" && raw.title.trim() ? raw.title.trim().slice(0, 80) : config.title,
          description: typeof raw.description === "string" ? raw.description.trim().slice(0, 180) : config.description,
          aiRationale: typeof raw.rationale === "string" ? raw.rationale.slice(0, 500) : config.aiRationale,
        },
        sourceSql: typeof raw.sourceSql === "string" && raw.sourceSql.trim() ? raw.sourceSql.trim() : sql,
        snapshot: currentSnapshot,
        rationale: typeof raw.rationale === "string" ? raw.rationale : "AI 基于字段、样本和探查结果生成。",
        confidence: typeof raw.confidence === "number" ? Math.max(0, Math.min(1, raw.confidence)) : 0.78,
      }
    })
    .filter((item): item is SuggestedCard => Boolean(item))
  return cards.length ? cards : fallback
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth()
    const body = (await req.json().catch(() => ({}))) as SuggestBody
    const columns = Array.isArray(body.columns) ? body.columns.filter((column) => column?.name && column?.type) : []
    const rows = Array.isArray(body.rows) ? body.rows : []
    const sql = body.sql?.trim() ?? ""
    const count = clampCount(body.count)
    const fallback = fallbackCards({ columns, rows, sql, count })
    if (!columns.length || !rows.length) {
      return NextResponse.json({ cards: fallback, source: "heuristic", message: "当前结果不足以进行 AI 推荐，已给出基础模板。" }, { headers: NO_STORE })
    }

    const provider = await getEffectiveProviderConfig(session.userId).catch(() => null)
    if (!provider) {
      return NextResponse.json({ cards: fallback, source: "heuristic", message: "当前账号没有可用 AI 配置，已使用本地规则生成看板。" }, { headers: NO_STORE })
    }

    const roles = inferColumnRoles(columns, rows)
    const system = [
      "你是 SQL Lab 的 BI 可视化架构师。",
      "请基于当前 SQL 结果、字段角色和可选探查结果，设计麦肯锡咨询级别的 BI 图表卡片。",
      "返回严格 JSON，不要 markdown：",
      '{ "cards": [{ "title": "", "description": "", "chartConfig": {}, "sourceSql": "", "rationale": "", "confidence": 0.0 }] }',
      "chartConfig 必须使用字段名，不要编造字段。type 可用：kpi, bar, horizontalBar, line, area, donut, pie, scatter, heatmap, funnel, table。",
      "优先生成互补图表：核心指标、排行、趋势、构成、交叉热力、明细核验。控制图表数量等于用户要求。",
      "如需更好的图表，可以调用 run_safe_sql 做只读聚合探查，最多 2 次。",
    ].join("\n")
    const messages: ProviderMessage[] = [
      { role: "system", content: system },
      {
        role: "user",
        content: JSON.stringify({
          requestedCardCount: count,
          sql,
          columns,
          roles,
          sampleRows: compactRows(rows),
          allowedThemes: ["report", "light", "dark"],
          defaultTheme: "report",
        }),
      },
    ]

    let first = await requestProviderChat({
      provider: { ...provider, temperature: Math.min(provider.temperature, 0.2) },
      messages,
      tools: [TOOL_RUN_SAFE_SQL],
      toolChoice: "auto",
      stream: false,
      timeoutMs: 60_000,
    })

    if (first.toolCalls.length) {
      messages.push({
        role: "assistant",
        content: first.assistantText || "",
        tool_calls: first.toolCalls.slice(0, 2).map((toolCall) => ({
          id: toolCall.id,
          type: "function",
          function: { name: toolCall.name, arguments: toolCall.argumentsText || "{}" },
        })),
      })
      for (const toolCall of first.toolCalls.slice(0, 2)) {
        if (toolCall.name !== "run_safe_sql") continue
        const probeSql = typeof toolCall.arguments?.sql === "string" ? toolCall.arguments.sql.trim() : ""
        const purpose = typeof toolCall.arguments?.purpose === "string" ? toolCall.arguments.purpose.trim() : "BI 图表探查"
        const probe = probeSql
          ? await executeSafeProbe(session.userId, { sql: probeSql, purpose, threadId: body.threadId ?? undefined }).catch((error) => ({ ok: false, error: error instanceof Error ? error.message : "probe failed" }))
          : { ok: false, error: "missing sql" }
        messages.push({ role: "tool", tool_call_id: toolCall.id, content: JSON.stringify(probe) })
      }
      first = await requestProviderChat({
        provider: { ...provider, temperature: 0 },
        messages,
        toolChoice: "none",
        stream: false,
        timeoutMs: 60_000,
      })
    }

    const parsed = extractJson<{ cards?: unknown[] }>(first.assistantText, {})
    const cards = normalizeCards(parsed.cards, fallback, columns, sql, rows).slice(0, count)
    return NextResponse.json({ cards, source: "ai" }, { headers: NO_STORE })
  } catch (error) {
    return jsonError(error)
  }
}
