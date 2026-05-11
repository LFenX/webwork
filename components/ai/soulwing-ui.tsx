import Link from "next/link"
import type { ElementType, ReactNode } from "react"
import { ArrowRight, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import { UserAvatar } from "@/components/user-avatar"

export function SoulWingPageShell({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("soulwing-page min-h-[calc(var(--app-viewport-height)-3.5rem)] bg-[#f4f7fb] text-slate-950 md:min-h-[calc(100vh-3.5rem)]", className)}>
      <div className="mx-auto w-full max-w-[1200px] px-4 py-5 sm:px-6 md:py-6 xl:px-0">
        {children}
      </div>
    </div>
  )
}

export function SoulWingPanel({
  title,
  description,
  icon: Icon,
  action,
  children,
  className,
  bodyClassName,
}: {
  title?: string
  description?: string
  icon?: ElementType
  action?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
}) {
  return (
    <section className={cn("overflow-hidden rounded-[18px] border border-slate-200/80 bg-white shadow-[0_18px_44px_rgba(15,23,42,0.055)]", className)}>
      {(title || description || action) && (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:px-5">
          <div className="min-w-0">
            {title && (
              <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-slate-950">
                {Icon && (
                  <span className="inline-flex size-8 items-center justify-center rounded-[10px] bg-blue-50 text-blue-600">
                    <Icon size={17} />
                  </span>
                )}
                <span className="min-w-0 truncate">{title}</span>
              </h2>
            )}
            {description && <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>}
          </div>
          {action}
        </div>
      )}
      <div className={cn("p-4 sm:p-5", bodyClassName)}>{children}</div>
    </section>
  )
}

export function SoulWingMetricCard({
  label,
  value,
  description,
  icon: Icon = Sparkles,
  tone = "blue",
}: {
  label: string
  value: string | number
  description?: string
  icon?: ElementType
  tone?: "blue" | "green" | "orange" | "slate"
}) {
  const toneClass = {
    blue: "bg-blue-50 text-blue-600 ring-blue-100",
    green: "bg-emerald-50 text-emerald-600 ring-emerald-100",
    orange: "bg-orange-50 text-orange-600 ring-orange-100",
    slate: "bg-slate-50 text-slate-600 ring-slate-100",
  }[tone]

  return (
    <div className="rounded-[16px] border border-slate-100 bg-white px-4 py-4 shadow-[0_10px_24px_rgba(15,23,42,0.035)]">
      <div className="flex items-center gap-3">
        <span className={cn("inline-flex size-10 shrink-0 items-center justify-center rounded-[13px] ring-1", toneClass)}>
          <Icon size={18} />
        </span>
        <div className="min-w-0">
          <p className="text-sm text-slate-500">{label}</p>
          <p className="mt-0.5 text-2xl font-semibold leading-none text-slate-950 tabular-nums">{value}</p>
        </div>
      </div>
      {description && <p className="mt-2 text-xs leading-5 text-slate-500">{description}</p>}
    </div>
  )
}

export function SoulWingHero({
  name,
  email,
  avatarText,
  avatarUrl,
  metrics,
}: {
  name: string
  email: string
  avatarText?: string | null
  avatarUrl?: string | null
  metrics: Array<{ label: string; value: string | number; description?: string; icon?: ElementType; tone?: "blue" | "green" | "orange" | "slate" }>
}) {
  return (
    <section className="overflow-hidden rounded-[22px] border border-slate-200/80 bg-white shadow-[0_24px_70px_rgba(37,99,235,0.10)]">
      <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-center">
        <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center">
          <UserAvatar name={name} email={email} avatarText={avatarText} avatarUrl={avatarUrl} size="xl" className="rounded-full ring-4 ring-blue-50" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">蝶灵控制台</h1>
              <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-600">SoulWing</span>
            </div>
            <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
              管理你的专属 AI 助手：人格、记忆、模型和自动回复都集中在这里。
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href="/ai" className="inline-flex min-h-10 items-center gap-2 rounded-full bg-blue-600 px-4 text-sm font-semibold text-white shadow-[0_12px_26px_rgba(37,99,235,0.24)] hover:bg-blue-700 hover:no-underline">
                返回聊天 <ArrowRight size={15} />
              </Link>
              <Link href="/friends?type=channel&id=soulwing-roundtable" className="inline-flex min-h-10 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-blue-600 hover:border-blue-200 hover:bg-blue-50 hover:no-underline">
                查看圆桌
              </Link>
            </div>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {metrics.map((metric) => (
            <SoulWingMetricCard key={metric.label} {...metric} />
          ))}
        </div>
      </div>
    </section>
  )
}

export function SoulWingEmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="rounded-[18px] border border-dashed border-slate-200 bg-slate-50/70 px-6 py-10 text-center">
      <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-blue-50 text-blue-600">
        <Sparkles size={20} />
      </div>
      <p className="mt-3 text-sm font-semibold text-slate-900">{title}</p>
      {description && <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>}
    </div>
  )
}
