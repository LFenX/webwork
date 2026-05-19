import Link from "next/link"
import type { ElementType, ReactNode } from "react"
import {
  ArrowRight,
  BriefcaseBusiness,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  Clock3,
  Eye,
  FileText,
  Mail,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  Sparkles,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { formatChinaDateTime, formatDateKey } from "@/lib/time"
import { UserAvatar } from "@/components/user-avatar"
import { EmptyState } from "@/components/empty-state"
import { ProfileShareActionButton } from "@/components/profile/profile-share-action-button"

type ActionVariant = "primary" | "secondary" | "ghost"

export type PersonalAction = {
  label: string
  href: string
  icon?: ElementType
  variant?: ActionVariant
  copyHref?: string
  copySuccessLabel?: string
  copyFailedLabel?: string
}

export type PersonalMetric = {
  label: string
  value: string | number
  unit?: string
  sub?: string
  icon?: ElementType
  tone?: "blue" | "green" | "orange" | "red" | "slate"
}

export type PersonalContentItem = {
  key: string
  title: string
  href?: string
  date?: string
  summary?: string
  label?: string
  meta?: string
  tags?: string[]
  value?: string | number
}

export type HeatmapDatum = Record<string, number>

export type ChatParticipant = {
  id: string
  displayName: string
  email: string
  avatarText: string
  avatarUrl: string | null
}

export type VisitDetailItem = {
  id: string
  visitorName: string
  visitorEmail?: string
  visitorAvatarText?: string
  visitorAvatarUrl?: string | null
  module: string
  path: string
  createdAt: string
}

const visitModuleLabels: Record<string, string> = {
  home: "主页",
  resume: "简历",
  blog: "博客",
  daily: "日常",
  reflections: "心得",
  notes: "笔记",
  jobs: "求职",
  interviews: "面试",
}

const toneClasses: Record<NonNullable<PersonalMetric["tone"]>, { icon: string; dot: string; text: string; soft: string }> = {
  blue: {
    icon: "bg-blue-50 text-blue-600 ring-blue-100",
    dot: "bg-blue-500",
    text: "text-blue-600",
    soft: "bg-blue-50 text-blue-700",
  },
  green: {
    icon: "bg-emerald-50 text-emerald-600 ring-emerald-100",
    dot: "bg-emerald-500",
    text: "text-emerald-600",
    soft: "bg-emerald-50 text-emerald-700",
  },
  orange: {
    icon: "bg-orange-50 text-orange-500 ring-orange-100",
    dot: "bg-orange-400",
    text: "text-orange-500",
    soft: "bg-orange-50 text-orange-700",
  },
  red: {
    icon: "bg-rose-50 text-rose-500 ring-rose-100",
    dot: "bg-rose-500",
    text: "text-rose-500",
    soft: "bg-rose-50 text-rose-700",
  },
  slate: {
    icon: "bg-slate-50 text-slate-600 ring-slate-100",
    dot: "bg-slate-400",
    text: "text-slate-600",
    soft: "bg-slate-50 text-slate-700",
  },
}

function formatDateLabel(date?: string) {
  if (!date) return ""
  const key = formatDateKey(date)
  return key ? key.slice(5) : date
}

function formatNumber(value: string | number) {
  if (typeof value === "string") return value
  if (value >= 10000) return `${Math.round(value / 1000)}k`
  return value.toLocaleString("zh-CN")
}

function mergeHeatmapData(...sources: HeatmapDatum[]) {
  return sources.reduce<HeatmapDatum>((merged, source) => {
    Object.entries(source).forEach(([key, value]) => {
      merged[key] = (merged[key] ?? 0) + value
    })
    return merged
  }, {})
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10)
}

function buildHeatmapCells(data: HeatmapDatum, days: number) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Array.from({ length: days }, (_, index) => {
    const current = new Date(today)
    current.setDate(today.getDate() - (days - index - 1))
    const key = dateKey(current)
    return { key, value: data[key] ?? 0 }
  })
}

function heatmapColor(value: number) {
  if (value >= 8) return "bg-emerald-500"
  if (value >= 5) return "bg-emerald-400"
  if (value >= 3) return "bg-emerald-300"
  if (value >= 1) return "bg-emerald-200"
  return "bg-slate-100"
}

function trendPath(values: number[]) {
  const resolved = values.length > 1 ? values : [2, 2.5, 2.1, 3, 2.8, 3.4, 3.2]
  const max = Math.max(...resolved, 1)
  const step = 96 / Math.max(resolved.length - 1, 1)
  return resolved
    .map((value, index) => {
      const x = index * step
      const y = 36 - (value / max) * 28
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(" ")
}

function ActionLink({ action, large = false }: { action: PersonalAction; large?: boolean }) {
  const Icon = action.icon
  const variant = action.variant ?? "secondary"
  if (action.copyHref) {
    return (
      <ProfileShareActionButton
        href={action.copyHref}
        label={action.label}
        large={large}
        variant={variant}
        copiedLabel={action.copySuccessLabel}
        copyFailedLabel={action.copyFailedLabel}
      />
    )
  }
  return (
    <Link
      href={action.href}
      className={cn(
        "inline-flex min-w-0 items-center justify-center gap-2 rounded-[12px] text-sm font-semibold transition-all hover:-translate-y-px hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
        large ? "min-h-12 px-5" : "min-h-10 px-4",
        variant === "primary" && "bg-blue-600 !text-white shadow-[0_12px_24px_rgba(37,99,235,0.24)] hover:bg-blue-700 hover:!text-white",
        variant === "secondary" && "border border-blue-200 bg-white text-blue-600 shadow-sm hover:border-blue-300 hover:bg-blue-50",
        variant === "ghost" && "border border-slate-200 bg-white text-slate-700 shadow-sm hover:border-slate-300 hover:bg-slate-50"
      )}
    >
      {Icon && <Icon size={large ? 19 : 16} className="shrink-0" />}
      <span className="truncate">{action.label}</span>
    </Link>
  )
}

export function PersonalHomeShell({
  children,
  variant = "self",
}: {
  children: ReactNode
  variant?: "self" | "public"
}) {
  return (
    <div
      className={cn(
        "personal-home min-h-[calc(100vh-3.5rem)] bg-[#f4f7fb] text-slate-950",
        variant === "public" && "personal-home-public -mt-14 md:mt-0"
      )}
    >
      <div className="mx-auto w-full max-w-[1760px] px-4 py-4 sm:px-6 sm:py-5 lg:px-12 xl:px-16">
        {children}
      </div>
    </div>
  )
}

export function PersonalHomeGrid({ main, aside }: { main: ReactNode; aside: ReactNode }) {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_520px] 2xl:gap-5">
      <main className="min-w-0 space-y-4 2xl:space-y-5">{main}</main>
      <aside className="min-w-0 space-y-4 2xl:space-y-5">{aside}</aside>
    </div>
  )
}

export function PersonalHeroCard({
  name,
  email,
  bio,
  location,
  avatarText,
  avatarUrl,
  actions,
  backHref,
  backLabel = "返回好友",
  mobileTitle,
  publicMode = false,
}: {
  name: string
  email?: string | null
  bio?: string | null
  location?: string | null
  avatarText?: string | null
  avatarUrl?: string | null
  actions: PersonalAction[]
  backHref?: string
  backLabel?: string
  mobileTitle?: string
  publicMode?: boolean
}) {
  const visibleBio = bio?.trim() || "持续记录想法、项目和生活。"
  const primaryActions = actions.slice(0, 2)
  const secondaryActions = actions.slice(2)

  return (
    <section className="overflow-hidden rounded-[18px] border border-slate-200/80 bg-white shadow-[0_14px_36px_rgba(15,23,42,0.06)]">
      {backHref && (
        <div className="flex min-h-[58px] items-center justify-between border-b border-slate-200/80 bg-white px-4 md:hidden">
          <Link href={backHref} className="inline-flex min-h-11 items-center gap-2 text-base font-semibold text-slate-800 hover:text-blue-600 hover:no-underline">
            <ChevronLeft size={24} />
            {backLabel}
          </Link>
          <div className="max-w-[42vw] truncate text-lg font-semibold text-slate-950">{mobileTitle ?? name}</div>
          <button type="button" className="inline-flex size-11 items-center justify-center rounded-full text-slate-700 hover:bg-slate-100" aria-label="更多">
            <MoreHorizontal size={24} />
          </button>
        </div>
      )}

      <div className="relative px-5 py-6 sm:px-7 md:px-8 md:py-8">
        {publicMode && (
          <div className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-[radial-gradient(circle_at_18%_10%,rgba(147,197,253,0.55),transparent_38%),radial-gradient(circle_at_86%_0%,rgba(191,219,254,0.68),transparent_36%),linear-gradient(135deg,rgba(239,246,255,0.96),rgba(219,234,254,0.54)_48%,rgba(255,255,255,0)_78%)] md:hidden" />
        )}
        <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="grid min-w-0 grid-cols-[104px_minmax(0,1fr)] items-center gap-4 sm:flex sm:flex-row sm:items-center sm:gap-5">
            <div className="relative w-[104px] shrink-0 sm:w-fit">
              <div className={cn("rounded-full bg-white p-1 shadow-[0_14px_34px_rgba(37,99,235,0.16)] ring-4", publicMode ? "ring-white" : "ring-blue-50")}>
                <UserAvatar
                  size="xl"
                  name={name}
                  email={email}
                  avatarText={avatarText}
                  avatarUrl={avatarUrl}
                  presenceStatus="online"
                />
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <h1 className="min-w-0 max-w-full truncate text-[26px] font-bold leading-tight tracking-normal text-slate-950 sm:break-words sm:text-[28px] sm:[overflow-wrap:anywhere] md:text-[34px]">
                  {name}
                </h1>
                {!publicMode && (
                  <span className="inline-flex min-h-7 items-center rounded-full bg-blue-50 px-3 text-xs font-semibold text-blue-600">
                    个人主页
                  </span>
                )}
              </div>
              <p className="mt-2 line-clamp-2 max-w-2xl text-[15px] leading-6 text-slate-600 sm:mt-3 sm:line-clamp-none sm:leading-7">{visibleBio}</p>
              <div className="mt-4 hidden min-w-0 flex-wrap items-center gap-3 text-sm text-slate-500 sm:flex">
                {location?.trim() && (
                  <span className="inline-flex min-h-8 max-w-full min-w-0 items-center gap-1.5 rounded-full border border-slate-200 bg-white/80 px-3">
                    <MapPin size={15} className="shrink-0" />
                    <span className="truncate">{location}</span>
                  </span>
                )}
                {email && (
                  <span className="inline-flex min-h-8 max-w-full min-w-0 items-center gap-1.5 rounded-full border border-slate-200 bg-white/80 px-3">
                    <Mail size={15} className="shrink-0" />
                    <span className="truncate">{email}</span>
                  </span>
                )}
              </div>
            </div>
            <div className={cn("col-span-2 grid min-w-0 gap-2 text-[13px] text-slate-500 min-[360px]:text-sm sm:hidden", location?.trim() && email ? "grid-cols-2" : "grid-cols-1")}>
              {location?.trim() && (
                <span className="inline-flex min-h-10 w-full min-w-0 items-center gap-2 rounded-full border border-slate-200 bg-white/85 px-3">
                  <MapPin size={16} className="shrink-0" />
                  <span className="truncate">{location}</span>
                </span>
              )}
              {email && (
                <span className="inline-flex min-h-10 w-full min-w-0 items-center gap-2 rounded-full border border-slate-200 bg-white/85 px-3">
                  <Mail size={16} className="shrink-0" />
                  <span className="truncate">{email}</span>
                </span>
              )}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 md:w-[174px] md:grid-cols-1 lg:w-[190px]">
            {primaryActions.map((action) => <ActionLink key={action.href + action.label} action={action} large={publicMode} />)}
            {secondaryActions.length > 0 && (
              <div className="contents md:grid md:gap-3">
                {secondaryActions.map((action) => <ActionLink key={action.href + action.label} action={action} />)}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

export function MetricStrip({ metrics }: { metrics: PersonalMetric[] }) {
  return (
    <section className="rounded-[18px] border border-slate-200/80 bg-white p-3 shadow-[0_14px_34px_rgba(15,23,42,0.055)] sm:p-4">
      <div className="grid gap-2 min-[360px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
        {metrics.map((metric, index) => {
          const Icon = metric.icon ?? FileText
          const tone = toneClasses[metric.tone ?? "blue"]
          return (
            <div
              key={`${metric.label}-${index}`}
              className="min-w-0 rounded-[15px] border border-slate-100 bg-white px-3 py-3 shadow-[0_6px_18px_rgba(15,23,42,0.035)] xl:border-0 xl:border-r xl:border-slate-100 xl:shadow-none last:xl:border-r-0"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-[12px] ring-1", tone.icon)}>
                  <Icon size={19} />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-slate-500">{metric.label}</p>
                  <p className="mt-1 flex min-w-0 items-baseline gap-1 font-semibold leading-none text-slate-950 tabular-nums">
                    <span className="truncate text-2xl">{formatNumber(metric.value)}</span>
                    {metric.unit && <span className="text-xs font-medium text-slate-400">{metric.unit}</span>}
                  </p>
                  {metric.sub && <p className={cn("mt-1 truncate text-xs", metric.sub.includes("+") ? "text-emerald-600" : "text-slate-400")}>{metric.sub}</p>}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

export function HomePanel({
  title,
  icon: Icon,
  href,
  actionLabel = "查看全部",
  children,
  className,
  bodyClassName,
}: {
  title: string
  icon?: ElementType
  href?: string
  actionLabel?: string
  children: ReactNode
  className?: string
  bodyClassName?: string
}) {
  return (
    <section className={cn("overflow-hidden rounded-[18px] border border-slate-200/80 bg-white shadow-[0_14px_34px_rgba(15,23,42,0.055)]", className)}>
      <div className="flex min-h-[58px] items-center justify-between gap-3 border-b border-slate-100 px-4 sm:px-5">
        <div className="flex min-w-0 items-center gap-2.5">
          {Icon && (
            <span className="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-blue-50 text-blue-600">
              <Icon size={18} />
            </span>
          )}
          <h2 className="truncate text-lg font-semibold tracking-normal text-slate-950">{title}</h2>
        </div>
        {href && (
          <Link href={href} className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full px-2 text-sm font-semibold text-blue-600 hover:bg-blue-50 hover:no-underline">
            {actionLabel}
            <ArrowRight size={15} />
          </Link>
        )}
      </div>
      <div className={cn("p-4 sm:p-5", bodyClassName)}>{children}</div>
    </section>
  )
}

export function ContentListPanel({
  title,
  icon,
  href,
  items,
  emptyTitle,
  emptyDescription,
  featureFirst = false,
}: {
  title: string
  icon?: ElementType
  href?: string
  items: PersonalContentItem[]
  emptyTitle: string
  emptyDescription?: string
  featureFirst?: boolean
}) {
  return (
    <HomePanel title={title} icon={icon} href={href}>
      {items.length === 0 ? (
        <EmptyState title={emptyTitle} description={emptyDescription} compact className="border-slate-200 bg-slate-50/70" />
      ) : (
        <div className="space-y-3">
          {items.map((item, index) => {
            const content = (
              <div className={cn("group flex min-w-0 gap-3 rounded-[14px] p-2.5 transition-colors", item.href && "hover:bg-slate-50")}>
                {featureFirst && index === 0 ? (
                  <div className="h-[88px] w-[132px] shrink-0 overflow-hidden rounded-[12px] bg-[radial-gradient(circle_at_34%_34%,rgba(255,255,255,0.9),transparent_18%),linear-gradient(145deg,#eff6ff,#bfdbfe_48%,#60a5fa)] shadow-inner max-[520px]:h-[74px] max-[520px]:w-[104px]" />
                ) : (
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-blue-500" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <h3 className="min-w-0 text-sm font-semibold leading-6 text-slate-900 group-hover:text-blue-600 sm:text-[15px]">
                      {item.title}
                    </h3>
                    {item.label && (
                      <span className="hidden shrink-0 rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-500 sm:inline-flex">
                        {item.label}
                      </span>
                    )}
                  </div>
                  {item.summary && <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-500">{item.summary}</p>}
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                    {item.date && (
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays size={13} />
                        {formatDateLabel(item.date)}
                      </span>
                    )}
                    {item.meta && <span className="truncate">{item.meta}</span>}
                    {item.value !== undefined && (
                      <span className="inline-flex items-center gap-1">
                        <Eye size={13} />
                        {formatNumber(item.value)}
                      </span>
                    )}
                    {item.tags?.slice(0, 2).map((tag) => (
                      <span key={tag} className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-500">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )
            return item.href ? (
              <Link key={item.key} href={item.href} className="block hover:no-underline">
                {content}
              </Link>
            ) : (
              <div key={item.key}>{content}</div>
            )
          })}
        </div>
      )}
    </HomePanel>
  )
}

export function CompactListPanel({
  title,
  icon,
  href,
  items,
  emptyTitle,
  emptyDescription,
  tone = "blue",
}: {
  title: string
  icon?: ElementType
  href?: string
  items: PersonalContentItem[]
  emptyTitle: string
  emptyDescription?: string
  tone?: NonNullable<PersonalMetric["tone"]>
}) {
  const toneClass = toneClasses[tone]
  return (
    <HomePanel title={title} icon={icon} href={href}>
      {items.length === 0 ? (
        <EmptyState title={emptyTitle} description={emptyDescription} compact className="border-slate-200 bg-slate-50/70" />
      ) : (
        <div className="space-y-2.5">
          {items.map((item) => {
            const row = (
              <div className="group flex min-w-0 items-start gap-3 rounded-[14px] px-2.5 py-2 transition-colors hover:bg-slate-50">
                <span className={cn("mt-2 size-1.5 shrink-0 rounded-full", toneClass.dot)} />
                <div className="min-w-0 flex-1">
                  <p className="min-w-0 text-sm font-semibold leading-6 text-slate-900 group-hover:text-blue-600">{item.title}</p>
                  {item.summary && <p className="line-clamp-2 text-sm leading-6 text-slate-500">{item.summary}</p>}
                </div>
                <span className="shrink-0 text-xs text-slate-400">{item.meta || formatDateLabel(item.date)}</span>
              </div>
            )
            return item.href ? (
              <Link key={item.key} href={item.href} className="block hover:no-underline">
                {row}
              </Link>
            ) : (
              <div key={item.key}>{row}</div>
            )
          })}
        </div>
      )}
    </HomePanel>
  )
}

export function WritingStatsCard({
  articleCount,
  totalWords,
  streak,
  thisMonth,
}: {
  articleCount: number
  totalWords: number
  streak: number
  thisMonth: number
}) {
  const stats: PersonalMetric[] = [
    { label: "文章数", value: articleCount, icon: FileText, tone: "blue" },
    { label: "字数", value: formatNumber(totalWords), icon: Sparkles, tone: "green" },
    { label: "连续写作", value: streak, unit: "天", icon: CalendarDays, tone: "orange" },
    { label: "本月新增", value: thisMonth, unit: "篇", icon: FileText, tone: "slate" },
  ]
  return (
    <HomePanel title="写作统计" href="/blog" bodyClassName="p-4">
      <div className="grid grid-cols-2 gap-3">
        {stats.map((item) => {
          const Icon = item.icon ?? FileText
          const tone = toneClasses[item.tone ?? "blue"]
          return (
            <div key={item.label} className="rounded-[14px] border border-slate-100 bg-slate-50/70 p-3">
              <div className="mb-3 flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-slate-500">{item.label}</span>
                <Icon size={15} className={tone.text} />
              </div>
              <p className="flex items-baseline gap-1 text-2xl font-semibold leading-none text-slate-950 tabular-nums">
                {item.value}
                {item.unit && <span className="text-xs font-medium text-slate-400">{item.unit}</span>}
              </p>
            </div>
          )
        })}
      </div>
    </HomePanel>
  )
}

export function ChatActivityCard({
  directCount,
  channelCount,
  weeklyActive,
  participants = [],
}: {
  directCount: number
  channelCount: number
  weeklyActive: number
  participants?: ChatParticipant[]
}) {
  const total = directCount + channelCount
  const visibleParticipants = participants.slice(0, 6)
  return (
    <HomePanel title="聊天活跃" href="/friends" bodyClassName="p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center">
          {visibleParticipants.length > 0 ? (
            <div className="flex -space-x-2">
              {visibleParticipants.map((participant) => (
                <UserAvatar
                  key={participant.id}
                  size="sm"
                  name={participant.displayName}
                  email={participant.email}
                  avatarText={participant.avatarText}
                  avatarUrl={participant.avatarUrl}
                  className="rounded-full border-2 border-white shadow-sm"
                />
              ))}
            </div>
          ) : (
            <div className="flex -space-x-2">
              {[MessageCircle, Sparkles, CalendarDays].map((Icon, index) => (
                <span
                  key={index}
                  className="flex size-9 items-center justify-center rounded-full border-2 border-white bg-blue-50 text-blue-600 shadow-sm"
                >
                  <Icon size={15} />
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold text-slate-900">共 {formatNumber(total)} 条消息</p>
          <p className="text-xs text-slate-500">本周互动 {formatNumber(weeklyActive)} 次</p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3 border-t border-slate-100 pt-4">
        {[
          ["单聊", directCount],
          ["群聊", channelCount],
          ["本周", weeklyActive],
        ].map(([label, value]) => (
          <div key={label} className="min-w-0">
            <p className="text-xs text-slate-500">{label}</p>
            <p className="mt-1 text-xl font-semibold text-slate-950 tabular-nums">{formatNumber(value)}</p>
          </div>
        ))}
      </div>
    </HomePanel>
  )
}

export function JobFunnelCard({ steps, conversionRate, href = "/jobs" }: { steps: Array<{ label: string; value: number; color: string }>; conversionRate: number; href?: string }) {
  const max = Math.max(...steps.map((step) => step.value), 1)
  return (
    <HomePanel title="求职漏斗" href={href} bodyClassName="p-4">
      <div className="space-y-3">
        {steps.map((step) => (
          <div key={step.label} className="grid grid-cols-[52px_minmax(0,1fr)_42px] items-center gap-3 text-sm">
            <span className="text-slate-600">{step.label}</span>
            <div className="h-3 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full" style={{ width: `${Math.max(6, (step.value / max) * 100)}%`, backgroundColor: step.color }} />
            </div>
            <span className="text-right font-semibold text-slate-900 tabular-nums">{step.value}</span>
          </div>
        ))}
      </div>
      <p className="mt-4 text-center text-sm text-slate-500">整体转化率 {conversionRate}%</p>
    </HomePanel>
  )
}

export function VisitOverviewCard({
  total,
  uniqueVisitors,
  last30,
  trend,
  href,
  recentVisitors,
}: {
  total: number
  uniqueVisitors: number
  last30: number
  trend: number[]
  href?: string
  recentVisitors?: VisitDetailItem[]
}) {
  const metrics = [
    { label: "访问量", value: total, sub: "累计主页访问" },
    { label: "独立访客", value: uniqueVisitors, sub: "已识别访问者" },
    { label: "近 30 天", value: last30, sub: "近期热度" },
  ]
  const spark = trend.length > 0 ? trend : [1, 2, 1, 3, 2, 4, 3, 5, 4, 6, 5]
  const canExpandVisitors = recentVisitors !== undefined
  const visitorDetails = recentVisitors ?? []
  return (
    <HomePanel title="访问统计" href={href} bodyClassName="p-4">
      <div className="grid grid-cols-3 gap-3">
        {metrics.map((metric) => (
          <div key={metric.label} className="min-w-0 border-r border-slate-100 pr-3 last:border-r-0 last:pr-0">
            <p className="text-xs text-slate-500">{metric.label}</p>
            <p className="mt-1 text-2xl font-semibold leading-none text-slate-950 tabular-nums">{formatNumber(metric.value)}</p>
            <p className="mt-1 truncate text-xs text-slate-400">{metric.sub}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3">
        {metrics.map((metric, index) => (
          <svg key={metric.label} viewBox="0 0 96 40" className="h-10 w-full overflow-visible">
            <path d={trendPath(spark.slice(Math.max(0, index * 4), index * 4 + 8))} fill="none" stroke="#2563eb" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" opacity="0.86" />
          </svg>
        ))}
      </div>
      {canExpandVisitors && (
        <details className="group mt-4 overflow-hidden rounded-[15px] border border-slate-100 bg-slate-50/70">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-sm font-semibold text-slate-800 marker:hidden">
            <span className="min-w-0 truncate">最近访客</span>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-500 ring-1 ring-slate-200">
              {visitorDetails.length} 条
              <ChevronDown size={14} className="transition-transform group-open:rotate-180" />
            </span>
          </summary>
          <div className="border-t border-slate-100 p-3">
            {visitorDetails.length === 0 ? (
              <EmptyState title="暂无访客明细" description="新的主页和模块访问会出现在这里。" compact />
            ) : (
              <div className="max-h-72 overflow-y-auto pr-1">
                <div className="flex flex-col gap-2">
                  {visitorDetails.map((visit) => {
                    const moduleLabel = visitModuleLabels[visit.module] ?? visit.module
                    return (
                      <div key={visit.id} className="flex min-w-0 gap-3 rounded-[13px] border border-slate-100 bg-white px-3 py-2.5 shadow-[0_6px_16px_rgba(15,23,42,0.035)]">
                        <UserAvatar
                          size="sm"
                          name={visit.visitorName}
                          email={visit.visitorEmail}
                          avatarText={visit.visitorAvatarText}
                          avatarUrl={visit.visitorAvatarUrl}
                          className="mt-0.5 shrink-0 rounded-full"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex min-w-0 items-center justify-between gap-2">
                            <p className="min-w-0 truncate text-sm font-semibold text-slate-900">{visit.visitorName}</p>
                            <span className="shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-600">{moduleLabel}</span>
                          </div>
                          {visit.visitorEmail && <p className="mt-0.5 truncate text-xs text-slate-500">{visit.visitorEmail}</p>}
                          <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                            <span className="inline-flex items-center gap-1">
                              <Clock3 size={12} />
                              {formatChinaDateTime(visit.createdAt)}
                            </span>
                            {visit.path && (
                              <Link href={visit.path} className="min-w-0 truncate text-blue-600 hover:text-blue-700 hover:no-underline">
                                查看来源
                              </Link>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </details>
      )}
    </HomePanel>
  )
}

export function CompactHeatmapCard({
  contentData,
  chatData,
  careerData,
  days = 180,
  title = "活跃度",
}: {
  contentData: HeatmapDatum
  chatData?: HeatmapDatum
  careerData?: HeatmapDatum
  days?: number
  title?: string
}) {
  const merged = mergeHeatmapData(contentData, chatData ?? {}, careerData ?? {})
  const cells = buildHeatmapCells(merged, days)
  const total = cells.reduce((sum, item) => sum + item.value, 0)

  return (
    <HomePanel title={title} bodyClassName="p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="text-slate-500">近 {days} 天累计 {formatNumber(total)} 次记录</span>
        <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-medium text-slate-500">近 {days} 天</span>
      </div>
      <div className="overflow-x-auto pb-2">
        <div
          className="grid w-max grid-flow-col grid-rows-7 gap-1"
          style={{ gridTemplateColumns: `repeat(${Math.ceil(cells.length / 7)}, minmax(0, 10px))` }}
          aria-label={`${title}热力图`}
        >
          {cells.map((cell) => (
            <span
              key={cell.key}
              className={cn("size-[10px] rounded-[3px]", heatmapColor(cell.value))}
              title={`${cell.key}: ${cell.value}`}
            />
          ))}
        </div>
      </div>
      <div className="mt-3 flex items-center justify-center gap-2 text-xs text-slate-400">
        <span>较少</span>
        {[0, 1, 3, 5, 8].map((value) => (
          <span key={value} className={cn("size-3 rounded-[3px]", heatmapColor(value))} />
        ))}
        <span>较多</span>
      </div>
    </HomePanel>
  )
}

export function ModuleLinksCard({ links }: { links: Array<{ href: string; label: string; icon: ElementType }> }) {
  if (links.length === 0) return null
  return (
    <HomePanel title="可访问内容" bodyClassName="p-4">
      <div className="flex flex-wrap gap-2">
        {links.map((item) => {
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className="inline-flex min-h-10 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 shadow-sm hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600 hover:no-underline"
            >
              <Icon size={15} />
              {item.label}
            </Link>
          )
        })}
      </div>
    </HomePanel>
  )
}

export { BriefcaseBusiness, CalendarDays, MessageCircle }
