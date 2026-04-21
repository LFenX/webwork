"use client"

import { useMemo } from "react"

interface ActivityHeatmapProps {
  data: Record<string, number>
}

const WEEKS = 52
const DAYS = 7
const CELL = 12
const GAP = 2

function getColor(count: number): string {
  if (count === 0) return "var(--color-bg-hover)"
  if (count === 1) return "#b6e3b5"
  if (count <= 3) return "#6cc96b"
  if (count <= 6) return "#3a9c3a"
  return "#1e6b1e"
}

function toLocalDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

export function ActivityHeatmap({ data }: ActivityHeatmapProps) {
  const cells = useMemo(() => {
    const today = new Date()
    const result: { date: string; count: number; col: number; row: number }[] = []
    for (let w = WEEKS - 1; w >= 0; w--) {
      for (let d = 0; d < DAYS; d++) {
        const date = new Date(today)
        date.setDate(today.getDate() - (w * 7 + (today.getDay() - d + 7) % 7))
        const key = toLocalDate(date)
        result.push({ date: key, count: data[key] ?? 0, col: WEEKS - 1 - w, row: d })
      }
    }
    return result
  }, [data])

  const width = WEEKS * (CELL + GAP) - GAP
  const height = DAYS * (CELL + GAP) - GAP

  return (
    <svg width={width} height={height} className="block">
      {cells.map(({ date, count, col, row }) => (
        <rect
          key={date}
          x={col * (CELL + GAP)}
          y={row * (CELL + GAP)}
          width={CELL}
          height={CELL}
          rx={2}
          fill={getColor(count)}
        >
          <title>{`${date}: ${count} 条`}</title>
        </rect>
      ))}
    </svg>
  )
}
