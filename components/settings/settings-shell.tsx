import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { cn } from "@/lib/utils"

export function SettingsShell({
  title,
  description,
  backHref = "/settings",
  backLabel,
  eyebrow,
  children,
}: {
  title: string
  description?: string
  backHref?: string
  backLabel: string
  /** Optional small label above the title (e.g. "Settings · Live2D"). */
  eyebrow?: string
  children: React.ReactNode
}) {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <header className="mb-7 sm:mb-9">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1 rounded-full px-2 py-1 -mx-2 text-sm text-[--color-text-muted] transition-colors hover:bg-[--color-bg-hover] hover:text-[--color-text-primary] hover:no-underline"
        >
          <ChevronLeft size={15} />
          {backLabel}
        </Link>
        {eyebrow ? (
          <div className="mt-4 text-xs font-medium uppercase tracking-[0.14em] text-[--color-text-muted]">
            {eyebrow}
          </div>
        ) : null}
        <h1 className="mt-3 text-[28px] font-semibold leading-tight tracking-tight text-[--color-text-primary] sm:text-[32px]">
          {title}
        </h1>
        {description ? (
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[--color-text-secondary]">{description}</p>
        ) : null}
      </header>
      <div className="space-y-6">{children}</div>
    </div>
  )
}

/**
 * Standard panel used by every settings page. Renders a card with an optional
 * titled header, a body slot, and an optional footer slot (e.g. save row).
 */
export function SettingsSection({
  title,
  description,
  icon,
  footer,
  className,
  bodyClassName,
  children,
}: {
  title?: React.ReactNode
  description?: React.ReactNode
  icon?: React.ReactNode
  footer?: React.ReactNode
  className?: string
  bodyClassName?: string
  children: React.ReactNode
}) {
  const hasHeader = title || description || icon
  return (
    <section
      className={cn(
        "overflow-hidden rounded-[--radius-xl] border border-[--color-border] bg-[--color-bg-surface] shadow-[--shadow-profile-card]",
        className,
      )}
    >
      {hasHeader ? (
        <header className="flex items-start gap-3 border-b border-[--color-border] px-5 py-4 sm:px-6 sm:py-5">
          {icon ? (
            <span
              aria-hidden
              className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[--color-brand-soft] text-[--color-brand]"
            >
              {icon}
            </span>
          ) : null}
          <div className="min-w-0 flex-1">
            {title ? (
              <h2 className="text-[15px] font-semibold leading-tight text-[--color-text-primary]">{title}</h2>
            ) : null}
            {description ? (
              <p className="mt-1.5 text-[13px] leading-5 text-[--color-text-secondary]">{description}</p>
            ) : null}
          </div>
        </header>
      ) : null}
      <div className={cn("px-5 py-5 sm:px-6 sm:py-6", bodyClassName)}>{children}</div>
      {footer ? (
        <footer className="flex flex-wrap items-center justify-end gap-3 border-t border-[--color-border] bg-[--color-bg-soft] px-5 py-3.5 sm:px-6 sm:py-4">
          {footer}
        </footer>
      ) : null}
    </section>
  )
}

/** A labeled row used inside SettingsSection. Stacks on mobile, splits on sm+. */
export function SettingsRow({
  label,
  description,
  control,
  align = "center",
  className,
}: {
  label: React.ReactNode
  description?: React.ReactNode
  control: React.ReactNode
  align?: "start" | "center"
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:justify-between sm:gap-6",
        align === "start" ? "sm:items-start" : "sm:items-center",
        className,
      )}
    >
      <div className="max-w-md">
        <div className="text-[13px] font-medium text-[--color-text-primary]">{label}</div>
        {description ? (
          <p className="mt-1 text-[12.5px] leading-5 text-[--color-text-secondary]">{description}</p>
        ) : null}
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  )
}

/** Visual divider between SettingsRow groups inside a single SettingsSection. */
export function SettingsDivider() {
  return <div className="my-5 h-px bg-[--color-border]" aria-hidden />
}
