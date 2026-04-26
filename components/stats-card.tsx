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
        "rounded-[--radius-lg] bg-[--color-bg-surface] p-3 sm:p-5 shadow-[--shadow-sm] ring-1 ring-[--color-border] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[--shadow-md]",
        className
      )}
    >
      <p className="mb-0.5 sm:mb-1 text-[10px] sm:text-xs font-medium text-[--color-text-muted] truncate">{title}</p>
      <p className="text-xl sm:text-[1.75rem] font-bold text-[--color-text-primary] font-mono leading-none tracking-tight">
        {value}
      </p>
      {sub && (
        <p
          className={cn(
            "mt-1.5 text-xs font-medium",
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
