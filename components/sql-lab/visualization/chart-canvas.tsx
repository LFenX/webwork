"use client"

import { useEffect, useRef } from "react"
import * as echarts from "echarts/core"
import { BarChart, FunnelChart, HeatmapChart, LineChart, PieChart, ScatterChart } from "echarts/charts"
import { DataZoomComponent, GridComponent, LegendComponent, TitleComponent, TooltipComponent, VisualMapComponent } from "echarts/components"
import { CanvasRenderer } from "echarts/renderers"
import type { ECharts } from "echarts/core"
import { buildChartOptions, formatChartValue } from "@/lib/sql-lab/visualization/chart-options-builder"
import { metricKey, primaryMetric, resolveWorkbenchTheme, type ChartConfig } from "@/lib/sql-lab/visualization/chart-config"
import { prepareChartRows } from "@/lib/sql-lab/visualization/aggregate"
import type { SqlRunColumn } from "@/lib/sql-lab/types"
import { formatChartLabel } from "@/lib/sql-lab/visualization/formatters"

echarts.use([
  BarChart,
  FunnelChart,
  HeatmapChart,
  LineChart,
  PieChart,
  ScatterChart,
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  TitleComponent,
  TooltipComponent,
  VisualMapComponent,
  CanvasRenderer,
])

type Props = {
  rows: Array<Record<string, unknown>>
  columns: SqlRunColumn[]
  config: ChartConfig
  onReady?: (chart: ECharts) => void
}

export function ChartCanvas({ rows, columns, config, onReady }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const chartRef = useRef<ECharts | null>(null)
  const themeRef = useRef<string | undefined>(undefined)
  const theme = resolveWorkbenchTheme(config.theme)

  useEffect(() => {
    if (config.type === "kpi" || config.type === "table" || !rows.length || !config.x || !config.y) {
      chartRef.current?.dispose()
      chartRef.current = null
      themeRef.current = undefined
      return
    }
    if (!ref.current) return

    const echartsTheme = theme === "dark" ? "dark" : undefined
    if (chartRef.current && themeRef.current !== echartsTheme) {
      chartRef.current.dispose()
      chartRef.current = null
    }

    const chart = chartRef.current ?? echarts.init(ref.current, echartsTheme)
    chartRef.current = chart
    themeRef.current = echartsTheme
    chart.setOption(buildChartOptions(rows, config), true)
    onReady?.(chart)

    let frame = window.requestAnimationFrame(() => chart.resize())
    const lateResize = window.setTimeout(() => chart.resize(), 80)
    const resize = new ResizeObserver(() => {
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(() => chart.resize())
    })
    resize.observe(ref.current)
    return () => {
      resize.disconnect()
      window.cancelAnimationFrame(frame)
      window.clearTimeout(lateResize)
    }
  }, [config, onReady, rows, theme])

  useEffect(() => () => chartRef.current?.dispose(), [])

  if (config.type === "kpi") {
    const metric = primaryMetric(config)
    const key = metricKey(metric)
    const prepared = prepareChartRows(rows, { ...config, dimensions: [], topN: 1 })
    const value = prepared[0]?.[key] ?? rows[0]?.[metric.field ?? key]
    return (
      <div className="sql-chart-kpi">
        <small>{config.title || metric.label || metric.field || "记录数"}</small>
        <strong>{formatChartValue(value, config)}</strong>
        {config.description ? <em>{config.description}</em> : null}
      </div>
    )
  }

  if (config.type === "table") {
    return (
      <div className="sql-chart-mini-table">
        <table>
          <thead><tr>{columns.map((column) => <th key={column.name}>{column.name}</th>)}</tr></thead>
          <tbody>
            {rows.slice(0, 20).map((row, index) => (
              <tr key={index}>{columns.map((column) => <td key={column.name}>{formatChartLabel(row[column.name])}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  if (!rows.length) {
    return (
      <div className="sql-chart-empty">
        <strong>没有可视化数据</strong>
        <small>当前筛选条件下没有结果行。</small>
      </div>
    )
  }

  if (!config.x || !config.y) {
    return (
      <div className="sql-chart-empty">
        <strong>请选择 X / Y 字段</strong>
        <small>选择一个维度和一个指标后即可生成图表。</small>
      </div>
    )
  }

  return <div ref={ref} className="sql-chart-canvas" />
}
