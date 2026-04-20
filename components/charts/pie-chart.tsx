"use client"

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts"

interface PieChartProps {
  data: { name: string; value: number }[]
  height?: number
}

const COLORS = ["#C96442", "#3A7D5C", "#B8902D", "#A8463A", "#6B6B6B", "#0969DA", "#9A9A9A"]

export function SimplePieChart({ data, height = 200 }: PieChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="45%"
          innerRadius={50}
          outerRadius={75}
          paddingAngle={2}
          dataKey="value"
        >
          {data.map((_, index) => (
            <Cell key={index} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            background: "#fff",
            border: "1px solid #E5E3DC",
            borderRadius: 6,
            fontSize: 12,
            fontFamily: "var(--font-geist-mono)",
          }}
        />
        <Legend
          iconType="circle"
          iconSize={8}
          formatter={(v) => <span style={{ fontSize: 11, color: "#6B6B6B" }}>{v}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}
