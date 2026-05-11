import Link from "next/link"
import type { ElementType, ReactNode } from "react"
import { ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"

type ModulePageShellProps = {
  children: ReactNode
  className?: string
  contentClassName?: string
  maxWidth?: "content" | "wide" | "full"
}

type ModuleHeroProps = {
  title: string
  description?: string
  eyebrow?: string
  icon?: ElementType
  actions?: ReactNode
  meta?: ReactNode
  stats?: Array<{ label: string; value: ReactNode; hint?: string }>
  className?: string
}

type ModulePanelProps = {
  title?: string
  description?: string
  icon?: ElementType
  action?: ReactNode
  href?: string
  actionLabel?: string
  children?: ReactNode
  className?: string
  contentClassName?: string
}

const maxWidthClass = {
  content: "max-w-[1240px]",
  wide: "max-w-[1480px]",
  full: "max-w-[1760px]",
}

export function ModulePageShell({
  children,
  className,
  contentClassName,
  maxWidth = "wide",
}: ModulePageShellProps) {
  return (
    <div className={cn("module-page min-h-[calc(100vh-3.5rem)] bg-[#f4f7fb] text-slate-950", className)}>
      <div className={cn("mx-auto w-full px-4 py-4 sm:px-6 sm:py-6 lg:px-10 xl:px-14", maxWidthClass[maxWidth], contentClassName)}>
        {children}
      </div>
    </div>
  )
}

export function ModuleHero({
  title,
  description,
  eyebrow,
  icon: Icon,
  actions,
  meta,
  stats,
  className,
}: ModuleHeroProps) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-[22px] border border-slate-200/80 bg-white shadow-[0_18px_44px_rgba(15,23,42,0.06)]",
        className
      )}
    >
      <div className="flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          {Icon && (
            <span className="flex size-12 shrink-0 items-center justify-center rounded-[16px] bg-blue-50 text-blue-600 ring-1 ring-blue-100 sm:size-14">
              <Icon size={24} strokeWidth={1.8} />
            </span>
          )}
          <div className="min-w-0">
            {eyebrow && (
              <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-blue-600">{eyebrow}</p>
            )}
            <h1 className="text-2xl font-bold tracking-normal text-slate-950 sm:text-3xl">{title}</h1>
            {description && <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500 sm:text-base">{description}</p>}
            {meta && <div className="mt-4 flex flex-wrap items-center gap-2">{meta}</div>}
            {stats && stats.length > 0 && (
              <div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                {stats.map((item) => (
                  <span key={item.label} className="rounded-[14px] border border-slate-200 bg-slate-50 px-3 py-2">
                    <span className="block text-[11px] font-medium uppercase tracking-[0.08em] text-slate-400">{item.label}</span>
                    <span className="mt-0.5 block text-sm font-semibold text-slate-900">{item.value}</span>
                    {item.hint ? <span className="mt-0.5 block text-xs text-slate-500">{item.hint}</span> : null}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2 lg:justify-end">{actions}</div>}
      </div>
    </section>
  )
}

export function ModulePanel({
  title,
  description,
  icon: Icon,
  action,
  href,
  actionLabel = "View all",
  children,
  className,
  contentClassName,
}: ModulePanelProps) {
  const hasHeader = title || description || Icon || action || href
  return (
    <section
      className={cn(
        "min-w-0 overflow-hidden rounded-[20px] border border-slate-200/80 bg-white shadow-[0_14px_34px_rgba(15,23,42,0.055)]",
        className
      )}
    >
      {hasHeader && (
        <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5">
          <div className="flex min-w-0 items-start gap-3">
            {Icon && (
              <span className="flex size-9 shrink-0 items-center justify-center rounded-[12px] bg-blue-50 text-blue-600">
                <Icon size={18} strokeWidth={1.8} />
              </span>
            )}
            <div className="min-w-0">
              {title && <h2 className="text-lg font-bold tracking-normal text-slate-950">{title}</h2>}
              {description && <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>}
            </div>
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

export function ModuleStatGrid({
  children,
  className,
  stats,
}: {
  children?: ReactNode
  className?: string
  stats?: Array<{ label: string; value: ReactNode; hint?: string }>
}) {
  return (
    <div className={cn("grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 lg:grid-cols-4", className)}>
      {stats?.map((item) => (
        <div key={item.label} className="rounded-[18px] border border-slate-200 bg-white p-4 shadow-[0_12px_28px_rgba(15,23,42,0.045)]">
          <p className="text-sm text-slate-500">{item.label}</p>
          <p className="mt-2 text-2xl font-bold tabular-nums text-slate-950">{item.value}</p>
          {item.hint ? <p className="mt-1 text-xs text-slate-400">{item.hint}</p> : null}
        </div>
      ))}
      {children}
    </div>
  )
}

export function ModuleToolbar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-[18px] border border-slate-200/80 bg-white/88 p-3 shadow-[0_10px_26px_rgba(15,23,42,0.045)] sm:flex-row sm:items-center sm:justify-between sm:p-4",
        className
      )}
    >
      {children}
    </div>
  )
}

export function ModuleTableShell({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-[20px] border border-slate-200/80 bg-white shadow-[0_14px_34px_rgba(15,23,42,0.055)]", className)}>
      <div className="overflow-x-auto">{children}</div>
    </div>
  )
}

export function modulePillClass(active = false) {
  return cn(
    "inline-flex min-h-10 items-center justify-center gap-2 rounded-full border px-3 text-sm font-semibold transition-all hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
    active
      ? "border-blue-200 bg-blue-50 text-blue-600 shadow-sm"
      : "border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600"
  )
}

export function ModuleMetaPill({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex min-h-9 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-sm text-slate-600 shadow-sm", className)}>
      {children}
    </span>
  )
}
