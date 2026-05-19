import type { ChartConfig } from "@/lib/sql-lab/visualization/chart-config"
import { metricKey, primaryDimension, primaryMetric, secondaryDimension } from "@/lib/sql-lab/visualization/chart-config"
import { formatChartLabel, toNumber } from "@/lib/sql-lab/visualization/formatters"

export function prepareChartRows(rows: Array<Record<string, unknown>>, config: ChartConfig) {
  const x = primaryDimension(config)
  const yMetric = primaryMetric(config)
  const y = metricKey(yMetric)
  const groupBy = secondaryDimension(config)
  const aggregation = yMetric.aggregation ?? config.aggregation ?? (yMetric.field ? "sum" : "count")
  const shouldAggregate = Boolean(x) && config.type !== "table" && aggregation !== "none"

  if (!shouldAggregate) return limitAndSort(rows, config, yMetric.field ?? y)

  const groups = new Map<string, { row: Record<string, unknown>; values: number[]; count: number }>()
  for (const row of rows) {
    const keyParts = [formatChartLabel(row[x!])]
    if (groupBy) keyParts.push(formatChartLabel(row[groupBy]))
    const key = keyParts.join("\u0000")
    const current = groups.get(key) ?? {
      row: {
        [x!]: row[x!],
        ...(groupBy ? { [groupBy]: row[groupBy] } : {}),
      },
      values: [],
      count: 0,
    }
    current.count += 1
    if (yMetric.field) current.values.push(toNumber(row[yMetric.field]))
    groups.set(key, current)
  }

  const aggregated = [...groups.values()].map(({ row, values, count }) => {
    let value = count
    if (aggregation === "sum") value = values.reduce((sum, item) => sum + item, 0)
    else if (aggregation === "avg") value = values.length ? values.reduce((sum, item) => sum + item, 0) / values.length : 0
    else if (aggregation === "min") value = values.length ? Math.min(...values) : 0
    else if (aggregation === "max") value = values.length ? Math.max(...values) : 0
    return { ...row, [y]: value }
  })

  return limitAndSort(aggregated, config, y)
}

function limitAndSort(rows: Array<Record<string, unknown>>, config: ChartConfig, metric: string) {
  const direction = config.sort?.direction ?? "desc"
  const sorted = direction === "none"
    ? [...rows]
    : [...rows].sort((a, b) => {
        const delta = toNumber(a[metric]) - toNumber(b[metric])
        return direction === "asc" ? delta : -delta
      })
  const max = config.topN === "all" ? 5000 : Math.max(1, Math.min(5000, Number(config.topN ?? 20) || 20))
  return sorted.slice(0, max)
}
