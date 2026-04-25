import { cn } from "@/lib/utils"
import { Inbox } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getDict } from "@/lib/i18n"

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
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  const dict = getDict()
  const resolvedTitle = title ?? dict.common.noData

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-16 text-center",
        className
      )}
    >
      <Inbox className="w-10 h-10 text-[--color-text-muted] mb-3" strokeWidth={1.5} />
      <p className="text-sm font-medium text-[--color-text-secondary]">{resolvedTitle}</p>
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
