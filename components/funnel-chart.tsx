"use client"

interface FunnelStep {
  label: string
  value: number
  color?: string
}

interface FunnelChartProps {
  steps: FunnelStep[]
}

export function FunnelChart({ steps }: FunnelChartProps) {
  const max = steps[0]?.value || 1

  return (
    <div className="space-y-2">
      {steps.map((step, i) => {
        const pct = Math.round((step.value / max) * 100)
        const rate = i === 0 ? 100 : Math.round((step.value / (steps[i - 1]?.value || 1)) * 100)
        return (
          <div key={step.label}>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-[--color-text-secondary]">{step.label}</span>
              <span className="font-mono text-[--color-text-muted]">
                {step.value}
                {i > 0 && <span className="ml-1.5 text-[--color-text-muted]">({rate}%)</span>}
              </span>
            </div>
            <div className="h-5 rounded bg-[--color-bg-hover] overflow-hidden">
              <div
                className="h-full rounded transition-all duration-500"
                style={{
                  width: `${pct}%`,
                  backgroundColor: step.color ?? "var(--color-accent)",
                  opacity: 0.7 + 0.3 * (1 - i / steps.length),
                }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
