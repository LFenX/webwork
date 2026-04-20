import { cn } from "@/lib/utils"
import { JOB_STATUS_COLORS, INTERVIEW_RESULT_COLORS } from "@/lib/enums"

interface StatusBadgeProps {
  status: string
  type?: "job" | "interview"
  className?: string
}

export function StatusBadge({ status, type = "job", className }: StatusBadgeProps) {
  const colorMap = type === "job" ? JOB_STATUS_COLORS : INTERVIEW_RESULT_COLORS
  const color = colorMap[status] ?? "bg-[--color-bg-hover] text-[--color-text-secondary]"

  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium font-mono",
        color,
        className
      )}
    >
      {status}
    </span>
  )
}
