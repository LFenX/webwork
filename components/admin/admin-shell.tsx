import Link from "next/link"
import type { ReactNode } from "react"
import { ArrowLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

export type AdminNavItem = {
  key: string
  label: string
  href: string
  icon?: ReactNode
  badge?: string | number
  description?: string
}

export function AdminShell({
  title,
  description,
  eyebrow,
  navItems,
  activeKey,
  actions,
  children,
  backHref,
  backLabel,
}: {
  title: string
  description?: string
  eyebrow?: string
  navItems: AdminNavItem[]
  activeKey: string
  actions?: ReactNode
  children: ReactNode
  backHref?: string
  backLabel?: string
}) {
  return (
    <main className="min-h-screen bg-[#f3f7fb] text-slate-950">
      <div className="mx-auto w-full max-w-[1760px] px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
        <header className="mb-5 overflow-hidden rounded-[22px] border border-white/80 bg-white/92 p-5 shadow-[0_18px_55px_rgba(15,23,42,0.08)] ring-1 ring-slate-200/70 backdrop-blur md:p-6">
          {backHref ? (
            <Link
              href={backHref}
              className="mb-4 inline-flex min-h-10 items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 hover:no-underline"
            >
              <ArrowLeft size={16} />
              {backLabel ?? "返回"}
            </Link>
          ) : null}
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              {eyebrow ? <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">{eyebrow}</p> : null}
              <h1 className="text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">{title}</h1>
              {description ? <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500 sm:text-base">{description}</p> : null}
            </div>
            {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
          </div>
        </header>

        <div className="grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="xl:sticky xl:top-6 xl:self-start">
            <nav className="rounded-[22px] border border-white/80 bg-white/92 p-2 shadow-[0_16px_45px_rgba(15,23,42,0.07)] ring-1 ring-slate-200/70 backdrop-blur">
              <div className="flex gap-2 overflow-x-auto pb-1 xl:block xl:space-y-1 xl:overflow-visible xl:pb-0">
                {navItems.map((item) => {
                  const active = item.key === activeKey
                  return (
                    <Link
                      key={item.key}
                      href={item.href}
                      className={cn(
                        "group flex min-h-12 min-w-max items-center gap-3 rounded-[16px] px-3 py-2 text-sm font-medium transition hover:no-underline xl:min-w-0",
                        active
                          ? "bg-blue-600 text-white shadow-[0_12px_24px_rgba(37,99,235,0.22)]"
                          : "text-slate-600 hover:bg-blue-50 hover:text-blue-700"
                      )}
                    >
                      {item.icon ? (
                        <span
                          className={cn(
                            "flex h-9 w-9 shrink-0 items-center justify-center rounded-[14px] border transition",
                            active ? "border-white/20 bg-white/18 text-white" : "border-slate-200 bg-slate-50 text-blue-600 group-hover:border-blue-100 group-hover:bg-white"
                          )}
                        >
                          {item.icon}
                        </span>
                      ) : null}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{item.label}</span>
                        {item.description ? (
                          <span className={cn("mt-0.5 hidden truncate text-xs xl:block", active ? "text-blue-100" : "text-slate-400")}>
                            {item.description}
                          </span>
                        ) : null}
                      </span>
                      {item.badge !== undefined ? (
                        <span
                          className={cn(
                            "inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full px-2 text-xs",
                            active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                          )}
                        >
                          {item.badge}
                        </span>
                      ) : null}
                    </Link>
                  )
                })}
              </div>
            </nav>
          </aside>
          <section className="min-w-0 space-y-5">{children}</section>
        </div>
      </div>
    </main>
  )
}

export function AdminPanel({
  title,
  description,
  icon,
  action,
  children,
  className,
  bodyClassName,
}: {
  title?: string
  description?: string
  icon?: ReactNode
  action?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
}) {
  return (
    <section className={cn("overflow-hidden rounded-[22px] border border-white/80 bg-white shadow-[0_16px_45px_rgba(15,23,42,0.07)] ring-1 ring-slate-200/70", className)}>
      {title || description || icon || action ? (
        <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="flex min-w-0 items-start gap-3">
            {icon ? <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-blue-50 text-blue-600">{icon}</span> : null}
            <div className="min-w-0">
              {title ? <h2 className="text-lg font-semibold tracking-tight text-slate-950">{title}</h2> : null}
              {description ? <p className="mt-1 text-sm leading-5 text-slate-500">{description}</p> : null}
            </div>
          </div>
          {action ? <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div> : null}
        </div>
      ) : null}
      <div className={cn("p-4 sm:p-5", bodyClassName)}>{children}</div>
    </section>
  )
}

export function AdminStatCard({
  label,
  value,
  hint,
  icon,
  tone = "blue",
}: {
  label: string
  value: ReactNode
  hint?: ReactNode
  icon?: ReactNode
  tone?: "blue" | "green" | "orange" | "rose" | "slate"
}) {
  const toneClass = {
    blue: "bg-blue-50 text-blue-600 border-blue-100",
    green: "bg-emerald-50 text-emerald-600 border-emerald-100",
    orange: "bg-orange-50 text-orange-600 border-orange-100",
    rose: "bg-rose-50 text-rose-600 border-rose-100",
    slate: "bg-slate-50 text-slate-600 border-slate-100",
  }[tone]

  return (
    <div className="rounded-[18px] border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.05)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-slate-950">{value}</p>
        </div>
        {icon ? <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] border", toneClass)}>{icon}</span> : null}
      </div>
      {hint ? <p className="mt-2 text-xs leading-5 text-slate-500">{hint}</p> : null}
    </div>
  )
}

export function AdminToolbar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-3 rounded-[18px] border border-slate-200/80 bg-slate-50/80 p-3 sm:flex-row sm:items-center sm:justify-between", className)}>
      {children}
    </div>
  )
}

export function AdminEmptyState({
  title,
  description,
  icon,
  action,
}: {
  title: string
  description?: string
  icon?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center rounded-[18px] border border-dashed border-slate-200 bg-slate-50/70 px-4 py-8 text-center">
      {icon ? <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-[16px] bg-white text-blue-600 shadow-sm ring-1 ring-slate-200">{icon}</span> : null}
      <p className="text-sm font-semibold text-slate-800">{title}</p>
      {description ? <p className="mt-1 max-w-md text-sm leading-6 text-slate-500">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}

export function AdminTableWrap({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-[18px] border border-slate-200 bg-white", className)}>
      <div className="overflow-auto">{children}</div>
    </div>
  )
}

export function AdminInlineLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="inline-flex min-h-10 items-center gap-1 rounded-full px-3 text-sm font-medium text-blue-600 transition hover:bg-blue-50 hover:no-underline">
      {children}
      <ChevronRight size={15} />
    </Link>
  )
}
