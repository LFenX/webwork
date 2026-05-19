"use client"

import type { ChartAggregation, ChartConfig, ChartPalette, ChartTheme, ChartType } from "@/lib/sql-lab/visualization/chart-config"
import type { SqlRunColumn } from "@/lib/sql-lab/types"

const CHART_TYPES: Array<{ value: ChartType; label: string }> = [
  { value: "kpi", label: "KPI" },
  { value: "bar", label: "柱形" },
  { value: "horizontalBar", label: "横向条形" },
  { value: "line", label: "折线" },
  { value: "area", label: "面积" },
  { value: "donut", label: "环形" },
  { value: "pie", label: "饼图" },
  { value: "scatter", label: "散点" },
  { value: "heatmap", label: "热力" },
  { value: "funnel", label: "漏斗" },
  { value: "table", label: "明细表" },
]

const AGGREGATIONS: Array<{ value: ChartAggregation; label: string }> = [
  { value: "sum", label: "求和" },
  { value: "avg", label: "平均" },
  { value: "count", label: "计数" },
  { value: "max", label: "最大" },
  { value: "min", label: "最小" },
  { value: "none", label: "不聚合" },
]

const PALETTES: Array<{ value: ChartPalette; label: string }> = [
  { value: "consulting", label: "咨询蓝" },
  { value: "cool", label: "冷色" },
  { value: "warm", label: "暖色" },
  { value: "mono", label: "单色" },
  { value: "default", label: "默认" },
]

const THEMES: Array<{ value: Exclude<ChartTheme, "auto" | "gray">; label: string }> = [
  { value: "report", label: "报告" },
  { value: "light", label: "浅色" },
  { value: "dark", label: "深色" },
]

type Props = {
  config: ChartConfig
  columns: SqlRunColumn[]
  onChange: (config: ChartConfig) => void
  dense?: boolean
}

export function ChartToolbar({ config, columns, onChange, dense }: Props) {
  const metric = config.metrics?.[0] ?? { field: config.y, aggregation: config.aggregation }
  const update = (patch: Partial<ChartConfig>) => onChange({ ...config, ...patch })
  const updateMetric = (patch: Partial<NonNullable<ChartConfig["metrics"]>[number]>) => {
    const next = { ...metric, ...patch }
    update({ metrics: [next], y: next.field, aggregation: next.aggregation })
  }

  return (
    <div className={dense ? "sql-chart-config-grid is-dense" : "sql-chart-config-grid"}>
      <Control label="标题">
        <input value={config.title ?? ""} onChange={(event) => update({ title: event.target.value })} placeholder="图表标题" />
      </Control>
      <Control label="图表">
        <select value={config.type} onChange={(event) => update({ type: event.target.value as ChartType })}>
          {CHART_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
        </select>
      </Control>
      <Control label="维度">
        <select value={config.dimensions?.[0] ?? config.x ?? ""} onChange={(event) => update({ dimensions: [event.target.value, ...(config.dimensions ?? []).slice(1)].filter(Boolean), x: event.target.value })}>
          <option value="">无</option>
          {columns.map((column) => <option key={column.name} value={column.name}>{column.name}</option>)}
        </select>
      </Control>
      <Control label="指标">
        <select value={metric.field ?? ""} onChange={(event) => updateMetric({ field: event.target.value || undefined })}>
          <option value="">计数</option>
          {columns.map((column) => <option key={column.name} value={column.name}>{column.name}</option>)}
        </select>
      </Control>
      <Control label="聚合">
        <select value={metric.aggregation ?? config.aggregation ?? "sum"} onChange={(event) => updateMetric({ aggregation: event.target.value as ChartAggregation })}>
          {AGGREGATIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
      </Control>
      <Control label="分组">
        <select value={config.groupBy ?? config.dimensions?.[1] ?? ""} onChange={(event) => update({ groupBy: event.target.value || undefined, dimensions: [config.dimensions?.[0] ?? config.x ?? "", event.target.value].filter(Boolean) })}>
          <option value="">无</option>
          {columns.map((column) => <option key={column.name} value={column.name}>{column.name}</option>)}
        </select>
      </Control>
      <Control label="TopN">
        <select value={config.topN ?? 20} onChange={(event) => update({ topN: event.target.value === "all" ? "all" : Number(event.target.value) })}>
          <option value="8">8</option>
          <option value="12">12</option>
          <option value="20">20</option>
          <option value="50">50</option>
          <option value="all">全部</option>
        </select>
      </Control>
      <Control label="排序">
        <select value={config.sort?.direction ?? "desc"} onChange={(event) => update({ sort: { ...config.sort, direction: event.target.value as "asc" | "desc" | "none" } })}>
          <option value="desc">降序</option>
          <option value="asc">升序</option>
          <option value="none">原序</option>
        </select>
      </Control>
      <Control label="调色">
        <select value={config.palette ?? "consulting"} onChange={(event) => update({ palette: event.target.value as ChartPalette })}>
          {PALETTES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
      </Control>
      <Control label="主题">
        <select value={config.theme === "dark" || config.theme === "light" ? config.theme : "report"} onChange={(event) => update({ theme: event.target.value as ChartTheme })}>
          {THEMES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
      </Control>
      <Control label="单位">
        <input value={config.format?.unit ?? ""} onChange={(event) => update({ format: { ...config.format, unit: event.target.value } })} placeholder="如 人 / 次" />
      </Control>
      <Control label="小数">
        <input type="number" min={0} max={6} value={config.format?.decimals ?? ""} onChange={(event) => update({ format: { ...config.format, decimals: event.target.value === "" ? undefined : Number(event.target.value) } })} />
      </Control>
      <label className="sql-chart-check">
        <input type="checkbox" checked={config.showLabels ?? false} onChange={(event) => update({ showLabels: event.target.checked })} />
        <span>显示标签</span>
      </label>
      <label className="sql-chart-check">
        <input type="checkbox" checked={config.showLegend !== false} onChange={(event) => update({ showLegend: event.target.checked })} />
        <span>图例</span>
      </label>
      <label className="sql-chart-check">
        <input type="checkbox" checked={config.format?.percent ?? false} onChange={(event) => update({ format: { ...config.format, percent: event.target.checked } })} />
        <span>百分比</span>
      </label>
    </div>
  )
}

function Control({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="sql-chart-control">
      <span>{label}</span>
      {children}
    </label>
  )
}
