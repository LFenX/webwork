"use client"

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts"

interface BarChartProps {
  data: { name: string; value: number; color?: string }[]
  height?: number
}

export function SimpleBarChart({ data, height = 200 }: BarChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 8, top: 4, bottom: 4 }}>
        <XAxis type="number" tick={{ fontSize: 11, fill: "#9A9A9A", fontFamily: "var(--font-geist-mono)" }} />
        <YAxis
          type="category"
          dataKey="name"
          width={70}
          tick={{ fontSize: 11, fill: "#6B6B6B", fontFamily: "var(--font-geist-mono)" }}
        />
        <Tooltip
          contentStyle={{
            background: "#fff",
            border: "1px solid #E5E3DC",
            borderRadius: 6,
            fontSize: 12,
            fontFamily: "var(--font-geist-mono)",
          }}
          cursor={{ fill: "#F4F3EC" }}
        />
        <Bar dataKey="value" radius={[0, 3, 3, 0]}>
          {data.map((entry, index) => (
            <Cell key={index} fill={entry.color ?? "#C96442"} fillOpacity={0.85} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
