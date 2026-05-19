import type { EChartsCoreOption } from "echarts/core"
import {
  metricKey,
  primaryDimension,
  primaryMetric,
  resolveWorkbenchTheme,
  secondaryDimension,
  type ChartConfig,
} from "@/lib/sql-lab/visualization/chart-config"
import { prepareChartRows } from "@/lib/sql-lab/visualization/aggregate"
import { formatChartLabel, toNumber } from "@/lib/sql-lab/visualization/formatters"

const PALETTES = {
  consulting: ["#1f4e79", "#7f8fa6", "#c48a2c", "#2f6f73", "#8a3ffc", "#d45087"],
  default: ["#38bdf8", "#a78bfa", "#34d399", "#fbbf24", "#fb7185", "#22d3ee"],
  warm: ["#f97316", "#f59e0b", "#ef4444", "#ec4899", "#a855f7"],
  cool: ["#06b6d4", "#3b82f6", "#14b8a6", "#84cc16", "#8b5cf6"],
  mono: ["#1f4e79", "#3d6f99", "#5b8ab3", "#79a5cc", "#9abbdc", "#bdd3e8"],
}

export function buildChartOptions(rowsInput: Array<Record<string, unknown>>, config: ChartConfig): EChartsCoreOption {
  const rows = prepareChartRows(rowsInput, config)
  const x = primaryDimension(config)
  const yMetric = primaryMetric(config)
  const y = metricKey(yMetric)
  const groupBy = secondaryDimension(config)
  const palette = PALETTES[config.palette ?? "consulting"] ?? PALETTES.consulting
  const theme = resolveWorkbenchTheme(config.theme)
  const textColor = theme === "dark" ? "#e5edf7" : "#111827"
  const mutedColor = theme === "dark" ? "rgba(226, 232, 240, 0.64)" : "rgba(75, 85, 99, 0.72)"
  const splitLineColor = theme === "dark" ? "rgba(148, 163, 184, 0.16)" : "rgba(148, 163, 184, 0.24)"
  const grid = {
    top: config.title ? 46 : 28,
    right: config.showLegend === false ? 24 : 34,
    bottom: config.type === "horizontalBar" ? 28 : 54,
    left: config.type === "horizontalBar" ? 112 : 60,
    containLabel: true,
  }
  const base = {
    backgroundColor: "transparent",
    color: palette,
    textStyle: { color: textColor },
    animationDuration: 520,
    animationEasing: "cubicOut" as const,
    title: config.title
      ? {
          text: config.title,
          subtext: config.description,
          left: 8,
          top: 0,
          textStyle: { color: textColor, fontSize: 15, fontWeight: 700 },
          subtextStyle: { color: mutedColor, fontSize: 11, lineHeight: 16 },
        }
      : undefined,
  }

  if (!x || !y) {
    return { ...base, title: { text: "没有足够字段生成图表", left: "center", top: "middle", textStyle: { color: mutedColor, fontSize: 14, fontWeight: 600 } } }
  }

  if (config.type === "pie" || config.type === "donut" || config.type === "funnel") {
    const data = rows
      .map((row) => ({ name: formatChartLabel(row[x]), value: toNumber(row[y]) }))
      .filter((item) => Number.isFinite(item.value))
    return {
      ...base,
      legend: config.showLegend === false ? undefined : { type: "scroll", bottom: 0, textStyle: { color: mutedColor, fontSize: 11 } },
      tooltip: { trigger: "item", valueFormatter: (value: unknown) => formatChartValue(value, config) },
      series: [
        {
          type: config.type === "funnel" ? "funnel" : "pie",
          radius: config.type === "donut" ? ["46%", "68%"] : config.type === "pie" ? ["0%", "66%"] : undefined,
          center: config.type === "funnel" ? undefined : ["50%", "48%"],
          data,
          label: { color: textColor, formatter: config.showLabels ? "{b}\n{d}%" : undefined },
          labelLine: { lineStyle: { color: mutedColor } },
          itemStyle: { borderRadius: 3, borderColor: theme === "dark" ? "#07111f" : "#ffffff", borderWidth: 2 },
        },
      ],
    }
  }

  if (config.type === "scatter") {
    return {
      ...base,
      grid,
      tooltip: { trigger: "item", valueFormatter: (value: unknown) => formatChartLabel(value) },
      xAxis: { type: "value", name: x, axisLabel: { color: mutedColor }, axisLine: { lineStyle: { color: splitLineColor } }, splitLine: { lineStyle: { color: splitLineColor } } },
      yAxis: { type: "value", name: yMetric.label ?? y, axisLabel: { color: mutedColor }, axisLine: { lineStyle: { color: splitLineColor } }, splitLine: { lineStyle: { color: splitLineColor } } },
      series: [{ type: "scatter", symbolSize: 9, data: rows.map((row) => [toNumber(row[x]), toNumber(row[y]), row]) }],
    }
  }

  if (config.type === "heatmap" && groupBy) {
    const xCats = unique(rows.map((row) => formatChartLabel(row[x])))
    const yCats = unique(rows.map((row) => formatChartLabel(row[groupBy])))
    const values = rows.map((row) => [xCats.indexOf(formatChartLabel(row[x])), yCats.indexOf(formatChartLabel(row[groupBy])), toNumber(row[y])])
    const max = Math.max(1, ...values.map((item) => Number(item[2]) || 0))
    return {
      ...base,
      grid,
      tooltip: { position: "top" },
      xAxis: { type: "category", data: xCats, axisLabel: { color: mutedColor }, axisLine: { lineStyle: { color: splitLineColor } } },
      yAxis: { type: "category", data: yCats, axisLabel: { color: mutedColor }, axisLine: { lineStyle: { color: splitLineColor } } },
      visualMap: { min: 0, max, calculable: true, orient: "horizontal", left: "center", bottom: 0, inRange: { color: ["#e8eef5", palette[0]] }, textStyle: { color: mutedColor } },
      series: [{ type: "heatmap", data: values, label: { show: config.showLabels, color: textColor }, emphasis: { itemStyle: { shadowBlur: 8, shadowColor: "rgba(0,0,0,0.18)" } } }],
    }
  }

  const categories = rows.map((row) => formatChartLabel(row[x]))
  const lineLike = config.type === "line" || config.type === "area"
  const grouped = groupBy ? unique(rows.map((row) => formatChartLabel(row[groupBy]))) : []
  const series = grouped.length
    ? grouped.map((group, index) => ({
        name: group,
        type: lineLike ? "line" : "bar",
        smooth: lineLike,
        areaStyle: config.type === "area" ? { opacity: 0.18 } : undefined,
        emphasis: { focus: "series" },
        itemStyle: { borderRadius: config.type === "horizontalBar" ? [0, 3, 3, 0] : [3, 3, 0, 0] },
        data: categories.map((category) => {
          const match = rows.find((row) => formatChartLabel(row[x]) === category && (groupBy ? formatChartLabel(row[groupBy]) === group : true))
          return match ? toNumber(match[y]) : 0
        }),
        color: palette[index % palette.length],
      }))
    : [
        {
          type: lineLike ? "line" : "bar",
          smooth: lineLike,
          areaStyle: config.type === "area" ? { opacity: 0.18 } : undefined,
          itemStyle: { borderRadius: config.type === "horizontalBar" ? [0, 3, 3, 0] : [3, 3, 0, 0] },
          label: { show: config.showLabels, color: textColor, position: config.type === "horizontalBar" ? "right" : "top", formatter: (params: { value: unknown }) => formatChartValue(params.value, config) },
          data: rows.map((row) => toNumber(row[y])),
        },
      ]
  return {
    ...base,
    grid,
    legend: grouped.length && config.showLegend !== false ? { type: "scroll", top: config.title ? 32 : 0, right: 0, textStyle: { color: mutedColor, fontSize: 11 } } : undefined,
    tooltip: { trigger: "axis", valueFormatter: (value: unknown) => formatChartValue(value, config) },
    xAxis: config.type === "horizontalBar"
      ? { type: "value", axisLabel: { color: mutedColor, formatter: (value: unknown) => formatChartValue(value, config) }, axisLine: { lineStyle: { color: splitLineColor } }, splitLine: { lineStyle: { color: splitLineColor } } }
      : { type: "category", data: categories, axisLabel: { color: mutedColor, hideOverlap: true }, axisLine: { lineStyle: { color: splitLineColor } }, axisTick: { lineStyle: { color: splitLineColor } } },
    yAxis: config.type === "horizontalBar"
      ? { type: "category", data: categories, axisLabel: { color: mutedColor }, axisLine: { lineStyle: { color: splitLineColor } }, axisTick: { lineStyle: { color: splitLineColor } } }
      : { type: "value", axisLabel: { color: mutedColor, formatter: (value: unknown) => formatChartValue(value, config) }, axisLine: { lineStyle: { color: splitLineColor } }, splitLine: { lineStyle: { color: splitLineColor } } },
    dataZoom: categories.length > 24 && config.type !== "horizontalBar" ? [{ type: "inside" }, { type: "slider", height: 16, bottom: 8, borderColor: "transparent", textStyle: { color: mutedColor } }] : undefined,
    series,
  }
}

function unique(values: string[]) {
  return [...new Set(values)]
}

export function formatChartValue(value: unknown, config: ChartConfig) {
  const number = toNumber(value)
  if (!Number.isFinite(number)) return formatChartLabel(value)
  const decimals = config.format?.decimals ?? (Math.abs(number) >= 100 ? 0 : 1)
  const base = config.format?.compact === false
    ? number.toFixed(decimals)
    : new Intl.NumberFormat("zh-CN", {
        notation: Math.abs(number) >= 10000 ? "compact" : "standard",
        maximumFractionDigits: decimals,
      }).format(number)
  return `${base}${config.format?.percent ? "%" : ""}${config.format?.unit ?? ""}`
}
