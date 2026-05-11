import Link from "next/link"
import { FileText } from "lucide-react"
import type { ReactNode } from "react"
import { EmptyState } from "@/components/empty-state"
import { SectionCard } from "@/components/profile/section-card"
import { cn } from "@/lib/utils"

export type ProfileListItem = {
  key: string
  title: string
  href: string
  date?: string | null
  summary?: string | null
  label?: string | null
  tags?: string[]
}

type ContentListCardProps = {
  title: string
  description?: string
  href?: string
  actionLabel?: string
  items: ProfileListItem[]
  emptyTitle: string
  emptyDescription?: string
  className?: string
}

export function ContentListCard({
  title,
  description,
  href,
  actionLabel,
  items,
  emptyTitle,
  emptyDescription,
  className,
}: ContentListCardProps) {
  return (
    <SectionCard title={title} description={description} href={href} actionLabel={actionLabel} className={className} contentClassName="p-3 sm:p-4">
      {items.length === 0 ? (
        <EmptyState title={emptyTitle} description={emptyDescription} icon={FileText} compact />
      ) : (
        <div className="flex min-w-0 flex-col gap-2">
          {items.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              className="group block min-w-0 rounded-[16px] border border-transparent px-3 py-3 transition-all hover:border-[--color-brand-border] hover:bg-white/74 hover:shadow-[0_10px_24px_rgba(15,23,42,0.05)] hover:no-underline"
            >
              <div className="flex min-w-0 items-start gap-3">
                {item.date && <span className="mt-1 w-[4.75rem] shrink-0 font-mono text-xs text-[--color-text-muted]">{item.date.slice(0, 10)}</span>}
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                    <p className="min-w-0 flex-1 text-sm font-semibold leading-6 text-[--color-text-primary] transition-colors group-hover:text-[--color-brand]">
                      {item.title}
                    </p>
                    {item.label && (
                      <span className="shrink-0 rounded-full bg-[--color-bg-hover] px-2 py-0.5 text-[11px] font-medium text-[--color-text-muted]">
                        {item.label}
                      </span>
                    )}
                  </div>
                  {item.summary && <p className="mt-1 line-clamp-2 text-xs leading-5 text-[--color-text-muted]">{item.summary}</p>}
                  {item.tags && item.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {item.tags.slice(0, 4).map((tag) => (
                        <span key={tag} className="rounded-full bg-[--color-brand-soft] px-2 py-0.5 text-[11px] font-medium text-[--color-brand]">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </SectionCard>
  )
}

export function CompactRowList({
  items,
  emptyTitle,
  emptyDescription,
  className,
}: {
  items: ReactNode[]
  emptyTitle: string
  emptyDescription?: string
  className?: string
}) {
  if (items.length === 0) return <EmptyState title={emptyTitle} description={emptyDescription} compact />
  return <div className={cn("flex flex-col gap-2", className)}>{items}</div>
}
