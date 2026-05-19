import type { SqlRunColumn } from "@/lib/sql-lab/types"

export type ColumnRole = "time" | "category" | "metric" | "id" | "boolean" | "text"
export type ChartType =
  | "line"
  | "bar"
  | "horizontalBar"
  | "area"
  | "pie"
  | "donut"
  | "scatter"
  | "heatmap"
  | "funnel"
  | "kpi"
  | "table"
export type ChartTheme = "report" | "light" | "dark" | "gray" | "auto"
export type ResolvedChartTheme = "report" | "light" | "dark"
export type ChartPalette = "consulting" | "default" | "warm" | "cool" | "mono"
export type ChartAggregation = "sum" | "avg" | "count" | "min" | "max" | "none"
export type ChartSortDirection = "asc" | "desc" | "none"

export type ChartMetric = {
  field?: string
  label?: string
  aggregation?: ChartAggregation
}

export type ChartFormat = {
  unit?: string
  decimals?: number
  percent?: boolean
  compact?: boolean
}

export type ChartLayout = {
  w?: number
  h?: number
}

export type ChartConfig = {
  type: ChartType
  title?: string
  description?: string
  dimensions?: string[]
  metrics?: ChartMetric[]
  aggregation?: ChartAggregation
  sort?: {
    by?: string
    direction?: ChartSortDirection
  }
  format?: ChartFormat
  layout?: ChartLayout
  aiRationale?: string
  x?: string
  y?: string
  groupBy?: string
  palette?: ChartPalette
  topN?: number | "all"
  theme?: ChartTheme
  showLegend?: boolean
  showLabels?: boolean
}

export type ChartDataInput = {
  columns: SqlRunColumn[]
  rows: Array<Record<string, unknown>>
}

export type ChartSnapshot = {
  columns: SqlRunColumn[]
  rows: Array<Record<string, unknown>>
  rowCount: number
  truncated?: boolean
  generatedAt: string
}

export type BiCardLayout = {
  id: string
  x?: number
  y: number
  w: number
  h: number
  hidden?: boolean
}

export type SqlBiDashboard = {
  id: string
  name: string
  theme: ResolvedChartTheme
  layout: BiCardLayout[]
  createdAt: string
  updatedAt: string
}

export function resolveChartTheme(theme?: ChartTheme): ResolvedChartTheme {
  if (theme === "dark") return "dark"
  if (theme === "light") return "light"
  return "light"
}

export function resolveWorkbenchTheme(theme?: ChartTheme): ResolvedChartTheme {
  if (theme === "dark") return "dark"
  if (theme === "light") return "light"
  return "report"
}

export function primaryDimension(config: ChartConfig) {
  return config.dimensions?.[0] || config.x
}

export function secondaryDimension(config: ChartConfig) {
  return config.groupBy || config.dimensions?.[1]
}

export function primaryMetric(config: ChartConfig): ChartMetric {
  return config.metrics?.[0] ?? {
    field: config.y,
    aggregation: config.aggregation,
  }
}

export function metricKey(metric: ChartMetric) {
  return metric.field || "__count"
}

export function normalizeChartConfig(input: unknown, columns: SqlRunColumn[] = []): ChartConfig {
  const raw = input && typeof input === "object" ? input as Partial<ChartConfig> : {}
  const columnNames = new Set(columns.map((column) => column.name))
  const isKnown = (value: unknown): value is string => typeof value === "string" && (!columnNames.size || columnNames.has(value))
  const type: ChartType = [
    "line",
    "bar",
    "horizontalBar",
    "area",
    "pie",
    "donut",
    "scatter",
    "heatmap",
    "funnel",
    "kpi",
    "table",
  ].includes(raw.type as ChartType) ? raw.type as ChartType : "table"
  const dimensions = Array.isArray(raw.dimensions)
    ? raw.dimensions.filter(isKnown).slice(0, 2)
    : [raw.x].filter(isKnown)
  const metrics = Array.isArray(raw.metrics)
    ? raw.metrics
        .map((metric) => metric && typeof metric === "object" ? metric as ChartMetric : null)
        .filter((metric): metric is ChartMetric => Boolean(metric && (!metric.field || isKnown(metric.field))))
        .slice(0, 3)
    : raw.y && isKnown(raw.y)
      ? [{ field: raw.y, aggregation: raw.aggregation }]
      : []

  return {
    type,
    title: typeof raw.title === "string" ? raw.title.slice(0, 80) : undefined,
    description: typeof raw.description === "string" ? raw.description.slice(0, 180) : undefined,
    dimensions,
    metrics,
    aggregation: isAggregation(raw.aggregation) ? raw.aggregation : metrics[0]?.aggregation,
    sort: {
      by: typeof raw.sort?.by === "string" ? raw.sort.by : undefined,
      direction: raw.sort?.direction === "asc" || raw.sort?.direction === "none" ? raw.sort.direction : "desc",
    },
    format: {
      unit: typeof raw.format?.unit === "string" ? raw.format.unit.slice(0, 12) : undefined,
      decimals: Number.isFinite(raw.format?.decimals) ? Math.max(0, Math.min(6, Number(raw.format?.decimals))) : undefined,
      percent: Boolean(raw.format?.percent),
      compact: raw.format?.compact !== false,
    },
    layout: {
      w: Math.max(3, Math.min(12, Number(raw.layout?.w ?? 6) || 6)),
      h: Math.max(2, Math.min(8, Number(raw.layout?.h ?? 4) || 4)),
    },
    x: dimensions[0],
    y: metrics[0]?.field,
    groupBy: isKnown(raw.groupBy) ? raw.groupBy : dimensions[1],
    palette: isPalette(raw.palette) ? raw.palette : "consulting",
    topN: raw.topN === "all" ? "all" : Math.max(1, Math.min(100, Number(raw.topN ?? 20) || 20)),
    theme: raw.theme === "dark" || raw.theme === "light" || raw.theme === "report" ? raw.theme : "report",
    showLegend: raw.showLegend !== false,
    showLabels: Boolean(raw.showLabels),
    aiRationale: typeof raw.aiRationale === "string" ? raw.aiRationale.slice(0, 500) : undefined,
  }
}

function isAggregation(value: unknown): value is ChartAggregation {
  return value === "sum" || value === "avg" || value === "count" || value === "min" || value === "max" || value === "none"
}

function isPalette(value: unknown): value is ChartPalette {
  return value === "consulting" || value === "default" || value === "warm" || value === "cool" || value === "mono"
}
