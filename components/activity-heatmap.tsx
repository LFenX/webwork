import { formatDateKey } from "@/lib/time"

interface ActivityHeatmapProps {
  data: Record<string, number>
  weeks?: number
}

const DAYS = 7

function getColor(count: number): string {
  if (count === 0) return "var(--color-bg-hover)"
  if (count === 1) return "#b6e3b5"
  if (count <= 3) return "#6cc96b"
  if (count <= 6) return "#3a9c3a"
  return "#1e6b1e"
}

export function ActivityHeatmap({ data, weeks = 26 }: ActivityHeatmapProps) {
  const today = new Date()
  const cells: { date: string; count: number; col: number; row: number }[] = []

  for (let w = weeks - 1; w >= 0; w--) {
    for (let d = 0; d < DAYS; d++) {
      const date = new Date(today)
      date.setDate(today.getDate() - (w * 7 + (today.getDay() - d + 7) % 7))
      const key = formatDateKey(date)
      cells.push({ date: key, count: data[key] ?? 0, col: weeks - 1 - w, row: d })
    }
  }

  return (
    <div
      className="grid w-full gap-1"
      style={{
        gridTemplateColumns: `repeat(${weeks}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${DAYS}, minmax(0, 1fr))`,
      }}
    >
      {cells.map(({ date, count, col, row }) => (
        <div
          key={date}
          className="aspect-square min-h-2 rounded-[2px]"
          style={{
            backgroundColor: getColor(count),
            gridColumn: col + 1,
            gridRow: row + 1,
          }}
          title={`${date}: ${count} 条`}
        />
      ))}
    </div>
  )
}
