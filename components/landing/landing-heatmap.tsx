const FILL_OPACITY = [0, 0.22, 0.42, 0.68, 1]

export function ActivityHeatmap({
  matrix,
  weeks = 53,
  cell = 13,
  gap = 3,
}: {
  matrix: number[][]
  weeks?: number
  cell?: number
  gap?: number
}) {
  const safeMatrix: number[][] =
    matrix.length > 0
      ? matrix
      : Array.from({ length: weeks }, () => Array(7).fill(0))
  const actualWeeks = safeMatrix.length
  const totalW = actualWeeks * (cell + gap) - gap
  const totalH = 7 * (cell + gap) - gap
  return (
    <svg width="100%" height={totalH} viewBox={`0 0 ${totalW} ${totalH}`} preserveAspectRatio="xMinYMid meet" style={{ display: "block", maxWidth: "100%" }}>
      {safeMatrix.map((col, w) =>
        col.map((v, d) => (
          <rect
            key={`${w}-${d}`}
            x={w * (cell + gap)}
            y={d * (cell + gap)}
            width={cell}
            height={cell}
            rx="2"
            fill={v === 0 ? "var(--surface-2)" : "var(--accent)"}
            fillOpacity={v === 0 ? 1 : FILL_OPACITY[Math.min(4, Math.max(0, v))]}
          />
        ))
      )}
    </svg>
  )
}

export function HeatLegendCells() {
  return (
    <>
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          style={{
            width: 11,
            height: 11,
            borderRadius: 2,
            background: i === 0 ? "var(--surface-2)" : "var(--accent)",
            opacity: i === 0 ? 1 : FILL_OPACITY[i],
            display: "inline-block",
          }}
        />
      ))}
    </>
  )
}
