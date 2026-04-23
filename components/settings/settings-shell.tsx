import Link from "next/link"
import { ChevronLeft } from "lucide-react"

export function SettingsShell({
  title,
  description,
  backHref = "/settings",
  backLabel,
  children,
}: {
  title: string
  description?: string
  backHref?: string
  backLabel: string
  children: React.ReactNode
}) {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6">
      <div className="mb-6">
        <Link
          href={backHref}
          className="mb-3 inline-flex items-center gap-1 text-sm text-[--color-text-muted] hover:text-[--color-text-primary] hover:no-underline"
        >
          <ChevronLeft size={16} />
          {backLabel}
        </Link>
        <h1 className="text-2xl font-semibold text-[--color-text-primary]">{title}</h1>
        {description ? <p className="mt-2 text-sm text-[--color-text-secondary]">{description}</p> : null}
      </div>
      {children}
    </div>
  )
}
