import { cn } from "@/lib/utils"
import type { ElementType } from "react"

interface StatsCardProps {
  title: string
  value: string | number
  sub?: string
  trend?: "up" | "down" | "neutral"
  unit?: string
  description?: string
  icon?: ElementType
  tone?: "blue" | "green" | "amber" | "coral" | "slate"
  className?: string
}

const TONE_CLASS: Record<NonNullable<StatsCardProps["tone"]>, string> = {
  blue: "bg-[--color-brand-soft] text-[--color-brand]",
  green: "bg-[--color-success-bg] text-[--color-success]",
  amber: "bg-[--color-warning-bg] text-[--color-warning]",
  coral: "bg-[--color-danger-bg] text-[--color-accent]",
  slate: "bg-[--color-bg-hover] text-[--color-text-secondary]",
}

export function StatsCard({ title, value, sub, trend, unit, description, icon: Icon, tone = "blue", className }: StatsCardProps) {
  return (
    <div
      className={cn(
        "group min-w-0 rounded-[18px] border border-[--color-border] bg-white/82 p-3.5 shadow-[0_10px_28px_rgba(15,23,42,0.045)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[--color-brand-border] hover:shadow-[0_18px_38px_rgba(15,23,42,0.075)] sm:p-4",
        className
      )}
    >
      <div className="mb-3 flex min-w-0 items-center justify-between gap-2">
        <p className="min-w-0 truncate text-xs font-semibold text-[--color-text-muted]">{title}</p>
        {Icon && (
          <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-full", TONE_CLASS[tone])}>
            <Icon size={15} />
          </span>
        )}
      </div>
      <p className="flex min-w-0 items-baseline gap-1 text-2xl font-semibold leading-none tracking-normal text-[--color-text-primary] tabular-nums sm:text-[1.8rem]">
        <span className="min-w-0 truncate">{value}</span>
        {unit && <span className="text-xs font-medium text-[--color-text-muted]">{unit}</span>}
      </p>
      {sub && (
        <p
          className={cn(
            "mt-2 text-xs font-medium leading-5",
            trend === "up" && "text-[--color-success]",
            trend === "down" && "text-[--color-danger]",
            (!trend || trend === "neutral") && "text-[--color-text-muted]"
          )}
        >
          {sub}
        </p>
      )}
      {description && <p className="mt-1 text-xs leading-5 text-[--color-text-muted]">{description}</p>}
    </div>
  )
}
