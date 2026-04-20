import { cn } from "@/lib/utils"

interface StatsCardProps {
  title: string
  value: string | number
  sub?: string
  trend?: "up" | "down" | "neutral"
  className?: string
}

export function StatsCard({ title, value, sub, trend, className }: StatsCardProps) {
  return (
    <div
      className={cn(
        "bg-[--color-bg-surface] border border-[--color-border] rounded-[--radius-lg] p-5",
        className
      )}
    >
      <p className="text-xs text-[--color-text-muted] mb-1">{title}</p>
      <p className="text-2xl font-semibold text-[--color-text-primary] font-mono leading-none">
        {value}
      </p>
      {sub && (
        <p
          className={cn(
            "text-xs mt-1.5",
            trend === "up" && "text-[--color-success]",
            trend === "down" && "text-[--color-danger]",
            (!trend || trend === "neutral") && "text-[--color-text-muted]"
          )}
        >
          {sub}
        </p>
      )}
    </div>
  )
}
