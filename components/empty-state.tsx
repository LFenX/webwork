import { cn } from "@/lib/utils"
import { Inbox } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { getDict } from "@/lib/i18n"
import type { ElementType } from "react"

interface EmptyStateProps {
  title?: string
  description?: string
  action?: {
    label: string
    onClick?: () => void
    href?: string
  }
  icon?: ElementType
  compact?: boolean
  className?: string
}

export function EmptyState({
  title,
  description,
  action,
  icon: Icon = Inbox,
  compact = false,
  className,
}: EmptyStateProps) {
  const dict = getDict()
  const resolvedTitle = title ?? dict.common.noData

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-[18px] border border-dashed border-slate-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.78),rgba(248,250,252,0.72))] text-center",
        compact ? "px-4 py-8" : "px-5 py-14",
        className
      )}
    >
      <span className="mb-3 flex size-11 items-center justify-center rounded-full bg-blue-50 text-blue-600">
        <Icon size={20} strokeWidth={1.7} />
      </span>
      <p className="text-sm font-medium text-slate-600">{resolvedTitle}</p>
      {description && (
        <p className="mt-1 max-w-xs text-xs leading-5 text-slate-400">{description}</p>
      )}
      {action?.href ? (
        <Button size="sm" className="mt-4" asChild>
          <Link href={action.href}>{action.label}</Link>
        </Button>
      ) : action?.onClick ? (
        <Button size="sm" className="mt-4" onClick={action.onClick}>
          {action.label}
        </Button>
      ) : null}
    </div>
  )
}
