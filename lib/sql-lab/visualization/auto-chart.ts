import type { ChartConfig, ChartType, ColumnRole } from "@/lib/sql-lab/visualization/chart-config"
import type { SqlRunColumn } from "@/lib/sql-lab/types"
import { isNumericValue, isTimeValue } from "@/lib/sql-lab/visualization/formatters"

function uniqueCount(rows: Array<Record<string, unknown>>, column: string, max = 40) {
  const values = new Set<string>()
  for (const row of rows.slice(0, 1000)) {
    values.add(String(row[column] ?? ""))
    if (values.size > max) break
  }
  return values.size
}

export function inferColumnRoles(columns: SqlRunColumn[], rows: Array<Record<string, unknown>>): Record<string, ColumnRole> {
  const roles: Record<string, ColumnRole> = {}
  for (const column of columns) {
    const values = rows.map((row) => row[column.name]).filter((value) => value !== null && value !== undefined)
    const lower = column.name.toLowerCase()
    const sample = values.slice(0, 20)
    if (/(^id$|id$|uuid|hash)/.test(lower) && uniqueCount(rows, column.name) > Math.min(rows.length * 0.8, 20)) {
      roles[column.name] = "id"
    } else if (/bool/.test(column.type) || sample.every((value) => typeof value === "boolean")) {
      roles[column.name] = "boolean"
    } else if (/(time|date)/.test(column.type) || sample.some(isTimeValue) || /(at|date|day|month)$/.test(lower)) {
      roles[column.name] = "time"
    } else if (/(int|numeric|decimal|float|double|real|number)/.test(column.type) || (sample.length > 0 && sample.every(isNumericValue))) {
      roles[column.name] = "metric"
    } else {
      roles[column.name] = "category"
    }
  }
  return roles
}

export function chooseChart(columns: SqlRunColumn[], rows: Array<Record<string, unknown>>): ChartConfig {
  if (!rows.length || !columns.length) return { type: "table", theme: "light", topN: "all" }
  const roles = inferColumnRoles(columns, rows)
  const byRole = (role: ColumnRole) => columns.filter((column) => roles[column.name] === role).map((column) => column.name)
  const times = byRole("time")
  const metrics = byRole("metric")
  const categories = byRole("category").filter((name) => uniqueCount(rows, name) <= 80)

  if (rows.length === 1 && metrics.length === 1 && columns.length <= 2) return { type: "kpi", y: metrics[0], theme: "light" }
  if (rows.length < 5 && columns.length > 4) return { type: "table", theme: "light" }

  let type: ChartType = "table"
  if (times.length && metrics.length && categories.length && uniqueCount(rows, categories[0], 9) <= 8) type = "line"
  else if (times.length && metrics.length) type = "line"
  else if (categories.length && metrics.length && uniqueCount(rows, categories[0], 31) <= 30) type = uniqueCount(rows, categories[0], 9) <= 8 ? "pie" : "bar"
  else if (metrics.length >= 2) type = "scatter"
  else if (metrics.length === 1) type = "kpi"

  return {
    type,
    title: "结果图表",
    dimensions: [times[0] ?? categories[0] ?? metrics[0]].filter(Boolean),
    metrics: [{ field: metrics[0] ?? columns[1]?.name ?? columns[0]?.name, aggregation: "sum" }],
    x: times[0] ?? categories[0] ?? metrics[0],
    y: metrics[0] ?? columns[1]?.name ?? columns[0]?.name,
    groupBy: categories[0] && times[0] ? categories[0] : undefined,
    theme: "report",
    palette: "consulting",
    topN: type === "bar" || type === "pie" ? 20 : "all",
    showLegend: true,
  }
}

export function suggestChartConfigs(columns: SqlRunColumn[], rows: Array<Record<string, unknown>>, count = 4): ChartConfig[] {
  if (!rows.length || !columns.length) return [{ type: "table", title: "结果明细", theme: "report", topN: 50 }]
  const roles = inferColumnRoles(columns, rows)
  const byRole = (role: ColumnRole) => columns.filter((column) => roles[column.name] === role).map((column) => column.name)
  const times = byRole("time")
  const metrics = byRole("metric")
  const categories = byRole("category").filter((name) => uniqueCount(rows, name) <= 80)
  const firstMetric = metrics[0] ?? columns.find((column) => column.name !== categories[0])?.name ?? columns[0]?.name
  const configs: ChartConfig[] = []

  if (firstMetric) {
    configs.push({
      type: "kpi",
      title: `${firstMetric} 总览`,
      description: "当前结果集的核心指标汇总",
      metrics: [{ field: firstMetric, aggregation: "sum" }],
      y: firstMetric,
      theme: "report",
      palette: "consulting",
      layout: { w: 3, h: 3 },
      format: { compact: true },
    })
  }

  if (categories[0] && firstMetric) {
    configs.push({
      type: "horizontalBar",
      title: `${categories[0]} 排行`,
      description: `按 ${firstMetric} 汇总的 Top 项`,
      dimensions: [categories[0]],
      metrics: [{ field: firstMetric, aggregation: "sum" }],
      x: categories[0],
      y: firstMetric,
      topN: 12,
      sort: { direction: "desc" },
      theme: "report",
      palette: "consulting",
      layout: { w: 6, h: 4 },
      showLabels: true,
    })
  }

  if (times[0] && firstMetric) {
    configs.push({
      type: categories[0] && uniqueCount(rows, categories[0], 9) <= 8 ? "line" : "area",
      title: `${firstMetric} 趋势`,
      description: `按 ${times[0]} 观察变化`,
      dimensions: [times[0]],
      metrics: [{ field: firstMetric, aggregation: "sum" }],
      groupBy: categories[0] && uniqueCount(rows, categories[0], 9) <= 8 ? categories[0] : undefined,
      x: times[0],
      y: firstMetric,
      topN: "all",
      sort: { direction: "asc" },
      theme: "report",
      palette: "cool",
      layout: { w: 9, h: 4 },
    })
  }

  if (categories[0] && firstMetric) {
    configs.push({
      type: "donut",
      title: `${categories[0]} 构成`,
      description: `查看 ${firstMetric} 的结构占比`,
      dimensions: [categories[0]],
      metrics: [{ field: firstMetric, aggregation: "sum" }],
      x: categories[0],
      y: firstMetric,
      topN: 8,
      theme: "report",
      palette: "warm",
      layout: { w: 5, h: 4 },
      showLabels: true,
    })
  }

  if (metrics.length >= 2) {
    configs.push({
      type: "scatter",
      title: `${metrics[0]} × ${metrics[1]}`,
      description: "观察两个指标之间的关系",
      dimensions: [metrics[0]],
      metrics: [{ field: metrics[1], aggregation: "none" }],
      x: metrics[0],
      y: metrics[1],
      topN: 500,
      theme: "report",
      palette: "cool",
      layout: { w: 6, h: 4 },
    })
  }

  if (categories.length >= 2 && firstMetric) {
    configs.push({
      type: "heatmap",
      title: `${categories[0]} / ${categories[1]} 热力`,
      description: "交叉维度下的强弱分布",
      dimensions: [categories[0], categories[1]],
      metrics: [{ field: firstMetric, aggregation: "sum" }],
      groupBy: categories[1],
      x: categories[0],
      y: firstMetric,
      topN: 80,
      theme: "report",
      palette: "mono",
      layout: { w: 7, h: 5 },
    })
  }

  configs.push({
    type: "table",
    title: "结果明细",
    description: "用于核对图表背后的原始记录",
    dimensions: columns.slice(0, 6).map((column) => column.name),
    topN: 50,
    theme: "report",
    layout: { w: 12, h: 4 },
  })

  return dedupeConfigs(configs).slice(0, Math.max(1, Math.min(8, count)))
}

function dedupeConfigs(configs: ChartConfig[]) {
  const seen = new Set<string>()
  return configs.filter((config) => {
    const key = `${config.type}:${config.dimensions?.join(",")}:${config.metrics?.map((metric) => metric.field).join(",")}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
