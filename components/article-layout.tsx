import Link from "next/link"
import { ArrowLeft, Pencil } from "lucide-react"

interface ArticleLayoutProps {
  backHref: string
  backLabel: string
  editHref?: string
  actions?: React.ReactNode
  children: React.ReactNode
}

export function ArticleLayout({ backHref, backLabel, editHref, actions, children }: ArticleLayoutProps) {
  return (
    <div className="max-w-[960px] mx-auto px-8 py-16">
      <div className="max-w-[760px] mx-auto">
        <div className="flex items-center justify-between mb-12">
          <Link
            href={backHref}
            className="inline-flex items-center gap-1.5 text-sm text-[--color-text-muted] hover:text-[--color-text-primary] hover:no-underline transition-colors"
          >
            <ArrowLeft size={13} /> {backLabel}
          </Link>
          <div className="flex items-center gap-3">
            {actions}
            {editHref && (
              <Link
                href={editHref}
                className="inline-flex items-center gap-1.5 text-sm text-[--color-text-muted] hover:text-[--color-text-primary] hover:no-underline transition-colors"
              >
                <Pencil size={13} /> 编辑
              </Link>
            )}
          </div>
        </div>
        {children}
      </div>
    </div>
  )
}
