import Link from "next/link"
import { ArrowRight } from "lucide-react"
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

type SectionCardProps = {
  title?: string
  description?: string
  href?: string
  actionLabel?: string
  action?: ReactNode
  children?: ReactNode
  className?: string
  contentClassName?: string
}

export function SectionCard({
  title,
  description,
  href,
  actionLabel = "查看全部",
  action,
  children,
  className,
  contentClassName,
}: SectionCardProps) {
  const hasHeader = title || description || href || action

  return (
    <section
      data-profile-section-card="true"
      className={cn(
        "min-w-0 overflow-hidden rounded-[18px] border border-slate-200/80 bg-white shadow-[0_14px_34px_rgba(15,23,42,0.055)]",
        className
      )}
    >
      {hasHeader && (
        <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5">
          <div className="min-w-0">
            {title && <h2 className="text-base font-semibold tracking-normal text-slate-950 sm:text-lg">{title}</h2>}
            {description && <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {action}
            {href && (
              <Link
                href={href}
                className="inline-flex min-h-10 items-center gap-1 rounded-full px-3 text-sm font-semibold text-blue-600 transition-all hover:bg-blue-50 hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
              >
                {actionLabel}
                <ArrowRight size={14} />
              </Link>
            )}
          </div>
        </div>
      )}
      {children !== undefined && <div className={cn("p-4 sm:p-5", contentClassName)}>{children}</div>}
    </section>
  )
}
