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
    <div className="flex min-w-0 flex-col gap-3">
      {steps.map((step, i) => {
        const pct = Math.round((step.value / max) * 100)
        const rate = i === 0 ? 100 : Math.round((step.value / (steps[i - 1]?.value || 1)) * 100)
        return (
          <div key={step.label} className="min-w-0">
            <div className="mb-1.5 flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs">
              <span className="font-medium text-[--color-text-secondary]">{step.label}</span>
              <span className="font-mono tabular-nums text-[--color-text-muted]">
                {step.value}
                {i > 0 && <span className="ml-1.5 text-[--color-text-muted]">({rate}%)</span>}
              </span>
            </div>
            <div className="h-5 overflow-hidden rounded-full bg-[--color-bg-hover]">
              <div
                className="h-full rounded-full transition-all duration-500"
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
