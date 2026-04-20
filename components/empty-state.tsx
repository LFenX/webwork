import { cn } from "@/lib/utils"
import { Inbox } from "lucide-react"
import { Button } from "@/components/ui/button"

interface EmptyStateProps {
  title?: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
  className?: string
}

export function EmptyState({
  title = "暂无数据",
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-16 text-center",
        className
      )}
    >
      <Inbox className="w-10 h-10 text-[--color-text-muted] mb-3" strokeWidth={1.5} />
      <p className="text-sm font-medium text-[--color-text-secondary]">{title}</p>
      {description && (
        <p className="text-xs text-[--color-text-muted] mt-1 max-w-xs">{description}</p>
      )}
      {action && (
        <Button size="sm" className="mt-4" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  )
}
