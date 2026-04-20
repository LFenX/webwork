"use client"

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts"

interface LineChartProps {
  data: { name: string; value: number }[]
  height?: number
}

export function SimpleLineChart({ data, height = 160 }: LineChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ left: 0, right: 8, top: 4, bottom: 4 }}>
        <XAxis
          dataKey="name"
          tick={{ fontSize: 11, fill: "#9A9A9A", fontFamily: "var(--font-geist-mono)" }}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fontSize: 11, fill: "#9A9A9A", fontFamily: "var(--font-geist-mono)" }}
          width={24}
        />
        <Tooltip
          contentStyle={{
            background: "#fff",
            border: "1px solid #E5E3DC",
            borderRadius: 6,
            fontSize: 12,
            fontFamily: "var(--font-geist-mono)",
          }}
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke="#C96442"
          strokeWidth={1.5}
          dot={{ fill: "#C96442", r: 3 }}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
