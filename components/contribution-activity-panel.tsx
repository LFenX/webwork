"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { Briefcase, ChevronDown, Edit3, MessageSquare } from "lucide-react"

// ── Types ──────────────────────────────────────────────────────────────────

type ActivityType = "content" | "chat" | "career"

type DayCell = { date: string; total: number; byType: Record<string, number> }

type RichEvent = { date: string; type: ActivityType; count: number; details: RichDetail[] }

type RichDetail = { title: string; sub?: string; href?: string; date: string }

type PostItem = { type?: string; slug?: string; title?: string; date?: string; typeLabel?: string }

type JobItem = { id: string; company?: string; position?: string; appliedAt?: string | Date; status?: string }

type DailyItem = { slug?: string; title?: string; date?: string }

type ChatActivitySummary = { directCount: number; channelCount: number; weeklyActive: number; heatmap: Record<string, number> }

// ── Constants ──────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = { content: "内容创作", chat: "聊天互动", career: "求职面试" }
const TYPE_COLORS: Record<string, string> = { content: "#22c55e", chat: "#3b82f6", career: "#8b5cf6" }
const TYPE_SELECTED_BG: Record<string, string> = {
  content: "rgba(34,197,94,0.12)",
  chat: "rgba(59,130,246,0.12)",
  career: "rgba(139,92,246,0.12)",
}
const TYPE_SELECTED_TEXT: Record<string, string> = { content: "#166534", chat: "#1d4ed8", career: "#5b21b6" }
const TYPE_SELECTED_BORDER: Record<string, string> = {
  content: "rgba(34,197,94,0.28)",
  chat: "rgba(59,130,246,0.28)",
  career: "rgba(139,92,246,0.28)",
}

const ALL_TYPES: ActivityType[] = ["content", "chat", "career"]
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
const WEEKDAYS = ["", "Mon", "", "Wed", "", "Fri", ""]
const LEVEL_COLORS = ["rgba(15,23,42,0.05)", "#c6f6d5", "#86efac", "#4ade80", "#166534"]
const ALL_YEARS = [2026, 2025, 2024, 2023]

function getLevel(count: number, max: number): number {
  if (count <= 0 || max <= 0) return 0
  const r = count / max
  if (r <= 0.25) return 1; if (r <= 0.5) return 2; if (r <= 0.75) return 3; return 4
}

function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

// ── Filter chips ───────────────────────────────────────────────────────────

function TypeFilter({ selected, onToggle }: { selected: Set<ActivityType>; onToggle: (t: ActivityType) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {ALL_TYPES.map((type) => {
        const active = selected.has(type)
        return (
          <button
            key={type} type="button" onClick={() => onToggle(type)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-all duration-150 ${
              active
                ? "shadow-sm"
                : "border-transparent bg-[--color-bg-hover] text-[--color-text-secondary] hover:bg-[--color-brand-soft] hover:text-[--color-brand]"
            }`}
            style={active ? {
              backgroundColor: TYPE_SELECTED_BG[type],
              color: TYPE_SELECTED_TEXT[type],
              borderColor: TYPE_SELECTED_BORDER[type],
            } : undefined}
          >
            <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: TYPE_COLORS[type] }} />
            {TYPE_LABELS[type]}
          </button>
        )
      })}
    </div>
  )
}

// ── Heatmap ────────────────────────────────────────────────────────────────

const CELL = 11
const GAP = 3
const COL_STEP = CELL + GAP // 14px per week column
const LABEL_W = 28

function Heatmap({ days, selectedTypes, maxTotal, activeDay, onHover, onSelect, year }: {
  days: DayCell[]; selectedTypes: Set<ActivityType>; maxTotal: number
  activeDay: DayCell | null; onHover: (d: DayCell | null) => void; onSelect: (d: DayCell | null) => void; year: number
}) {
  const { weeks, startDate, monthLabels } = useMemo(() => {
    const jan1 = new Date(year, 0, 1)
    const start = new Date(jan1); start.setDate(start.getDate() - start.getDay())
    const dec31 = new Date(year, 11, 31)
    const end = new Date(dec31); end.setDate(end.getDate() + (6 - end.getDay()))
    const totalDays = Math.ceil((end.getTime() - start.getTime()) / 86400000) + 1
    const w = Math.ceil(totalDays / 7)
    const mls: { label: string; week: number }[] = []
    for (let i = 0; i < w; i++) {
      const d = new Date(start); d.setDate(d.getDate() + i * 7)
      if (d.getDate() <= 7) mls.push({ label: MONTHS_SHORT[d.getMonth()], week: i })
    }
    return { weeks: w, startDate: start, monthLabels: mls }
  }, [year])
  const dayMap = useMemo(() => { const m = new Map<string, DayCell>(); days.forEach((d) => m.set(d.date, d)); return m }, [days])

  const gridWidth = weeks * COL_STEP // includes gap except after last col

  return (
    <div className="overflow-x-auto overflow-y-hidden pb-1" style={{ WebkitOverflowScrolling: "touch" }}>
      <div style={{ width: gridWidth + LABEL_W, minWidth: gridWidth + LABEL_W }}>
        {/* Month labels — positioned per week column */}
        <div className="relative h-4 mb-0.5" style={{ marginLeft: LABEL_W }}>
          {monthLabels.map((ml, i) => (
            <span key={i} className="absolute text-[10px] leading-none text-[--color-text-muted]"
              style={{ left: ml.week * COL_STEP }}>
              {ml.label}
            </span>
          ))}
        </div>

        <div className="flex" style={{ gap: 0 }}>
          {/* Weekday labels — 7 rows with same gap as grid */}
          <div className="flex shrink-0 flex-col" style={{ gap: GAP, width: LABEL_W, paddingTop: 0 }}>
            {WEEKDAYS.map((label, i) => label
              ? <span key={i} className="flex items-center text-[9px] leading-none text-[--color-text-muted]" style={{ height: CELL }}>{label}</span>
              : <div key={i} style={{ height: CELL }} />
            )}
          </div>

          {/* Day grid: weeks columns × 7 rows, column flow */}
          <div
            className="grid"
            style={{
              gap: GAP,
              gridTemplateColumns: `repeat(${weeks}, ${CELL}px)`,
              gridTemplateRows: `repeat(7, ${CELL}px)`,
              gridAutoFlow: "column",
              width: gridWidth,
            }}
          >
            {Array.from({ length: weeks * 7 }).map((_, i) => {
              const w = Math.floor(i / 7)
              const dow = i % 7
              const d = new Date(startDate)
              d.setDate(d.getDate() + w * 7 + dow)
              const ds = fmtDate(d)
              const cell = dayMap.get(ds)
              const total = cell ? ALL_TYPES.reduce((s, t) => s + (selectedTypes.has(t) ? (cell.byType[t] ?? 0) : 0), 0) : 0
              const level = getLevel(total, maxTotal)
              const future = d > new Date()
              return (
                <button key={ds} type="button"
                  className={`rounded-[2px] transition-colors hover:ring-1 hover:ring-[--color-brand]/40 ${activeDay?.date === ds ? "ring-1 ring-[--color-brand]" : ""}`}
                  style={{
                    width: CELL,
                    height: CELL,
                    backgroundColor: future ? "rgba(15,23,42,0.03)" : LEVEL_COLORS[level],
                    cursor: future ? "default" : "pointer",
                  }}
                  title={`${ds}: ${total} 次活动`}
                  onMouseEnter={() => { if (!future && cell) onHover(cell) }}
                  onMouseLeave={() => onHover(null)}
                  onClick={() => { if (future) return; onSelect(cell && cell.date === activeDay?.date ? null : (cell ?? null)) }}
                />
              )
            })}
          </div>
        </div>

        {/* Legend */}
        <div className="mt-2 flex items-center justify-end gap-1" style={{ marginLeft: LABEL_W, width: gridWidth }}>
          <span className="text-[10px] text-[--color-text-muted]">Less</span>
          {LEVEL_COLORS.map((c, i) => <div key={i} className="rounded-[2px]" style={{ width: CELL, height: CELL, backgroundColor: c }} />)}
          <span className="text-[10px] text-[--color-text-muted]">More</span>
        </div>
      </div>
    </div>
  )
}

// ── Day detail ─────────────────────────────────────────────────────────────

function DayDetail({ day }: { day: DayCell | null }) {
  if (!day) return null
  return (
    <div className="rounded-[--radius-md] bg-[--color-bg-hover]/60 p-4">
      <p className="text-sm font-semibold">{day.date}</p>
      <p className="mt-1 text-xs text-[--color-text-muted]">共 {day.total} 次活动</p>
      <div className="mt-3 space-y-1.5">
        {ALL_TYPES.map((t) => {
          const c = day.byType[t] ?? 0; if (c === 0) return null
          return <div key={t} className="flex items-center gap-2 text-xs text-[--color-text-secondary]"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: TYPE_COLORS[t] }} />{TYPE_LABELS[t]}：{c}</div>
        })}
      </div>
    </div>
  )
}

// ── Overview ───────────────────────────────────────────────────────────────

function ActivityOverview({ totalsByType, selectedTypes, filteredTotal }: {
  totalsByType: Record<string, number>; selectedTypes: Set<ActivityType>; filteredTotal: number
}) {
  const maxCount = Math.max(1, ...ALL_TYPES.map((t) => totalsByType[t] ?? 0))
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div>
        <h4 className="text-sm font-semibold">活动概况</h4>
        <p className="mt-2 text-sm leading-relaxed text-[--color-text-secondary]">
          当前筛选下共 {filteredTotal} 次行为活动。
        </p>
      </div>
      <div className="space-y-2">
        {ALL_TYPES.map((t) => {
          const count = totalsByType[t] ?? 0; const dimmed = !selectedTypes.has(t)
          const barWidth = maxCount > 0 ? Math.round((count / maxCount) * 100) : 0
          return (
            <div key={t} className="flex items-center gap-3">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: TYPE_COLORS[t], opacity: dimmed ? 0.3 : 1 }} />
              <span className={`w-16 shrink-0 text-xs ${dimmed ? "text-[--color-text-muted]" : "text-[--color-text-secondary]"}`}>{TYPE_LABELS[t]}</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[--color-bg-hover]"><div className="h-full rounded-full transition-all duration-500" style={{ width: `${barWidth}%`, backgroundColor: TYPE_COLORS[t], opacity: dimmed ? 0.25 : 0.85 }} /></div>
              <span className={`w-12 text-right text-xs font-mono ${dimmed ? "text-[--color-text-muted]" : "text-[--color-text-secondary]"}`}>{filteredTotal > 0 && !dimmed ? `${Math.round((count / filteredTotal) * 100)}%` : "—"}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Timeline ───────────────────────────────────────────────────────────────

function TimelineItem({ detail }: { detail: RichDetail }) {
  return (
    <div className="group flex items-start justify-between gap-3 py-1.5">
      <div className="min-w-0 flex-1">
        {detail.href ? (
          <Link href={detail.href}
            className="text-[13px] font-medium leading-snug text-[--color-text-primary] hover:text-[--color-brand] hover:underline decoration-[--color-brand]/25 underline-offset-[3px] transition-colors">
            {detail.title}
          </Link>
        ) : (
          <span className="text-[13px] font-medium leading-snug text-[--color-text-primary]">{detail.title}</span>
        )}
        {detail.sub && <p className="mt-0.5 text-[11px] leading-relaxed text-[--color-text-muted]">{detail.sub}</p>}
      </div>
      <span className="shrink-0 text-[10px] text-[--color-text-muted] mt-0.5">{detail.date.slice(5)}</span>
    </div>
  )
}

function RichTimeline({ events }: { events: RichEvent[] }) {
  const [expandedTypes, setExpandedTypes] = useState<Set<string>>(new Set())
  const [visibleMonths, setVisibleMonths] = useState(3)

  const grouped = useMemo(() => {
    const map = new Map<string, RichEvent[]>()
    events.forEach((ev) => {
      const d = new Date(ev.date)
      const y = d.getFullYear()
      const key = `${y} ${MONTHS_SHORT[d.getMonth()]}`
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(ev)
    })
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  }, [events])

  const visibleGroups = grouped.slice(0, visibleMonths)
  const hasMoreMonths = visibleMonths < grouped.length

  const toggleExpand = (key: string) => {
    setExpandedTypes((prev) => {
      const next = new Set(prev)
      if (next.has(key)) { next.delete(key) } else { next.add(key) }
      return next
    })
  }

  if (grouped.length === 0) return <div className="py-10 text-center text-sm text-[--color-text-muted]">近期暂无活动记录</div>

  return (
    <div className="relative">
      <div className="absolute left-[15px] top-0 bottom-0 w-px bg-[rgba(15,23,42,0.1)]" />
      <div className="space-y-10">
        {visibleGroups.map(([month, monthEvents]) => {
          const byType = new Map<ActivityType, RichEvent[]>()
          monthEvents.forEach((ev) => { if (!byType.has(ev.type)) byType.set(ev.type, []); byType.get(ev.type)!.push(ev) })
          return (
            <div key={month} className="relative pl-10">
              <div className="absolute left-[11px] top-1 h-2.5 w-2.5 rounded-full border-2 border-[--color-bg-surface] bg-[--color-brand]" />
              <h4 className="text-sm font-semibold tracking-tight">{month}</h4>
              <div className="mt-5 space-y-6">
                {[...byType.entries()].map(([type, evs]) => {
                  const total = evs.reduce((s, e) => s + e.count, 0)
                  const allDetails = evs.flatMap((e) => e.details)
                  const expandKey = `${month}-${type}`
                  const isExpanded = expandedTypes.has(expandKey)
                  const TypeIcon = type === "content" ? Edit3 : type === "chat" ? MessageSquare : Briefcase
                  const iconColor = TYPE_COLORS[type]
                  const visibleDetails = isExpanded ? allDetails : allDetails.slice(0, 5)
                  const hasMore = allDetails.length > 5
                  return (
                    <div key={type} className="relative pl-6">
                      <TypeIcon size={14} className="absolute left-0 top-0.5" style={{ color: iconColor }} strokeWidth={2} />
                      <p className="text-[13px] font-semibold">
                        {TYPE_LABELS[type]} <span className="font-normal text-xs text-[--color-text-muted]">· {total} 次</span>
                      </p>
                      <div className="mt-2 space-y-0 pl-4 border-l-2 border-[rgba(15,23,42,0.06)]">
                        {visibleDetails.map((d, i) => <TimelineItem key={i} detail={d} />)}
                        {hasMore && (
                          <button
                            type="button"
                            onClick={() => toggleExpand(expandKey)}
                            className="text-[11px] text-[--color-brand] hover:underline mt-1"
                          >
                            {isExpanded ? "收起" : `查看全部 ${allDetails.length} 条`}
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
      {hasMoreMonths && (
        <div className="mt-6 pl-10">
          <button
            type="button"
            onClick={() => setVisibleMonths((prev) => prev + 3)}
            className="rounded-full border border-[--color-border] px-4 py-1.5 text-xs font-medium text-[--color-text-secondary] transition-colors hover:bg-[--color-bg-hover] hover:text-[--color-text-primary]"
          >
            加载更早月份（还有 {grouped.length - visibleMonths} 个月）
          </button>
        </div>
      )}
    </div>
  )
}

// ── Activity weighting ─────────────────────────────────────────────────────

// Normalized activity weights: raw counts are not comparable across types.
// - 1 blog/article/daily post = 1 unit (significant creative effort)
// - 50 chat messages = 1 unit (messages are high-frequency, low-effort)
// - 1 job application/update = 1 unit (significant career action)
const WEIGHTS: Record<string, number> = { content: 1, chat: 0.02, career: 1 }

// ── Data computation ───────────────────────────────────────────────────────

function computeYearData(
  contentData: Record<string, number>, chatData: Record<string, number>, careerData: Record<string, number>, year: number,
) {
  const prefix = `${year}-`
  const allDates = new Set<string>()
  ;[contentData, chatData, careerData].forEach((m) => Object.keys(m).forEach((k) => { if (k.startsWith(prefix)) allDates.add(k) }))
  const days: DayCell[] = [...allDates].sort().map((date) => {
    const wContent = (contentData[date] ?? 0) * WEIGHTS.content
    const wChat = (chatData[date] ?? 0) * WEIGHTS.chat
    const wCareer = (careerData[date] ?? 0) * WEIGHTS.career
    return {
      date,
      total: wContent + wChat + wCareer,
      byType: { content: wContent, chat: wChat, career: wCareer } as Record<string, number>,
    }
  })
  const totalsByType = {
    content: Object.entries(contentData).filter(([k]) => k.startsWith(prefix)).reduce((s, [, v]) => s + v * WEIGHTS.content, 0),
    chat: Object.entries(chatData).filter(([k]) => k.startsWith(prefix)).reduce((s, [, v]) => s + v * WEIGHTS.chat, 0),
    career: Object.entries(careerData).filter(([k]) => k.startsWith(prefix)).reduce((s, [, v]) => s + v * WEIGHTS.career, 0),
  } as Record<string, number>
  return { days, totalsByType }
}

function buildRichEvents(
  year: number, chatData: Record<string, number>,
  recentPosts: PostItem[], recentDaily: DailyItem[], recentJobs: JobItem[],
  chatSummary?: ChatActivitySummary,
): RichEvent[] {
  const prefix = `${year}-`
  const events: RichEvent[] = []

  // Content
  const contentMap = new Map<string, RichDetail[]>()
  const allItems: Array<{ title?: string; date?: string; slug?: string; type?: string; typeLabel?: string }> = [...recentPosts, ...recentDaily]
  allItems.forEach((p) => {
    const d = p.date?.slice(0, 10) ?? ""; if (!d || !d.startsWith(prefix)) return
    const hrefBase = p.type === "daily" ? "/daily" : p.type ? `/${p.type}` : "/blog"
    const href = p.slug ? `${hrefBase}/${encodeURIComponent(p.slug)}` : undefined
    if (!contentMap.has(d)) contentMap.set(d, [])
    contentMap.get(d)!.push({ title: p.title || "未命名", sub: p.typeLabel ? `${p.typeLabel}` : undefined, href, date: d })
  })
  contentMap.forEach((details, date) => { events.push({ date, type: "content", count: details.length, details }) })

  // Career
  const careerMap = new Map<string, RichDetail[]>()
  recentJobs.forEach((j) => {
    const ds = typeof j.appliedAt === "string" ? j.appliedAt.slice(0, 10) : j.appliedAt instanceof Date ? fmtDate(j.appliedAt) : ""
    if (!ds || !ds.startsWith(prefix)) return
    const title = `${j.company || "未知公司"} / ${j.position || "未知岗位"}`
    if (!careerMap.has(ds)) careerMap.set(ds, [])
    careerMap.get(ds)!.push({ title, sub: j.status ? `状态：${j.status}` : undefined, href: `/jobs`, date: ds })
  })
  careerMap.forEach((details, date) => { events.push({ date, type: "career", count: details.length, details }) })

  // Chat — aggregate by month, not per-date
  const chatByMonth = new Map<string, { total: number; lastDate: string }>()
  Object.entries(chatData).forEach(([date, count]) => {
    if (!date.startsWith(prefix) || count <= 0) return
    const month = date.slice(0, 7)
    if (!chatByMonth.has(month)) chatByMonth.set(month, { total: 0, lastDate: date })
    const entry = chatByMonth.get(month)!
    entry.total += count
    if (date > entry.lastDate) entry.lastDate = date
  })
  chatByMonth.forEach(({ total, lastDate }, month) => {
    const chatDetails: RichDetail[] = []
    if (chatSummary) {
      if (chatSummary.directCount > 0) {
        chatDetails.push({ title: "私聊互动", sub: `${chatSummary.directCount} 次 · 本周活跃 ${chatSummary.weeklyActive} 次`, href: "/friends", date: lastDate })
      }
      if (chatSummary.channelCount > 0) {
        chatDetails.push({ title: "群聊发言", sub: `${chatSummary.channelCount} 次`, href: "/channels", date: lastDate })
      }
    }
    if (chatDetails.length === 0) {
      chatDetails.push({ title: "聊天互动", sub: `${total} 次`, href: "/friends", date: lastDate })
    }
    events.push({ date: `${month}-01`, type: "chat", count: total, details: chatDetails })
  })

  return events.sort((a, b) => b.date.localeCompare(a.date))
}

// ── Main ───────────────────────────────────────────────────────────────────

export function ContributionActivityPanel({
  contentData, chatData, careerData,
  recentPosts, recentDaily, recentJobs, chatActivity,
}: {
  contentData: Record<string, number>; chatData: Record<string, number>; careerData: Record<string, number>
  recentPosts: PostItem[]; recentDaily: DailyItem[]; recentJobs: JobItem[]
  chatActivity?: ChatActivitySummary
}) {
  const [activeYear, setActiveYear] = useState(2026)
  const [selectedTypes, setSelectedTypes] = useState<Set<ActivityType>>(new Set(ALL_TYPES))
  const [hoveredDay, setHoveredDay] = useState<DayCell | null>(null)
  const [selectedDay, setSelectedDay] = useState<DayCell | null>(null)
  const [timelineOpen, setTimelineOpen] = useState(false)

  const toggleType = (type: ActivityType) => {
    setSelectedTypes((prev) => {
      const next = new Set(prev)
      if (next.has(type)) { if (next.size > 1) next.delete(type) } else next.add(type)
      return next
    })
  }

  const yearData = useMemo(() => computeYearData(contentData, chatData, careerData, activeYear), [contentData, chatData, careerData, activeYear])
  const richEvents = useMemo(() => buildRichEvents(activeYear, chatData, recentPosts, recentDaily, recentJobs, chatActivity), [activeYear, chatData, recentPosts, recentDaily, recentJobs, chatActivity])

  const filteredTotal = ALL_TYPES.reduce((s, t) => s + (selectedTypes.has(t) ? (yearData.totalsByType[t] ?? 0) : 0), 0)
  const maxDaily = useMemo(() => {
    let max = 0
    yearData.days.forEach((d) => { let t = 0; ALL_TYPES.forEach((tp) => { if (selectedTypes.has(tp)) t += d.byType[tp] ?? 0 }); if (t > max) max = t })
    return max
  }, [yearData.days, selectedTypes])

  const displayDay = hoveredDay || selectedDay
  const filteredEvents = useMemo(() => richEvents.filter((ev) => selectedTypes.has(ev.type)), [richEvents, selectedTypes])
  const timelineToShow = timelineOpen ? filteredEvents : filteredEvents.slice(0, 20)

  return (
    <section className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">
          <span className="text-xl font-bold">{filteredTotal}</span>
          <span className="ml-2 text-sm font-normal text-[--color-text-secondary]">activities in {activeYear}</span>
        </h2>
        <TypeFilter selected={selectedTypes} onToggle={toggleType} />
      </div>

      {/* Main card */}
      <div className="overflow-hidden rounded-[--radius-xl] border border-[rgba(15,23,42,0.07)]"
        style={{
          background: "linear-gradient(180deg, rgba(255,255,255,0.72) 0%, rgba(255,255,255,0.48) 100%)",
          boxShadow: "0 18px 50px rgba(15,23,42,0.05)",
          backdropFilter: "blur(18px)",
          WebkitBackdropFilter: "blur(18px)",
        }}>
        <div className="flex flex-col lg:flex-row">
          <div className="min-w-0 flex-1 p-5">
            <Heatmap days={yearData.days} selectedTypes={selectedTypes} maxTotal={maxDaily} activeDay={selectedDay} onHover={setHoveredDay} onSelect={setSelectedDay} year={activeYear} />
            {displayDay && <div className="mt-4"><DayDetail day={displayDay} /></div>}
          </div>
          <div className="flex shrink-0 flex-row gap-1.5 border-t border-[rgba(15,23,42,0.06)] px-5 py-3 lg:flex-col lg:border-l lg:border-t-0 lg:px-4 lg:py-5">
            {ALL_YEARS.map((year) => (
              <button key={year} type="button"
                onClick={() => { setActiveYear(year); setSelectedDay(null); setHoveredDay(null) }}
                className={`rounded-[8px] px-3 py-1.5 text-xs font-semibold transition-all ${
                  activeYear === year
                    ? "bg-[rgba(59,130,246,0.14)] text-[#1d4ed8] border border-[rgba(59,130,246,0.28)] shadow-[0_6px_16px_rgba(59,130,246,0.1)]"
                    : "border border-transparent text-[--color-text-secondary] hover:bg-[--color-bg-hover] hover:text-[--color-text-primary]"
                }`}
              >{year}</button>
            ))}
          </div>
        </div>
        <div className="border-t border-[rgba(15,23,42,0.06)] p-5">
          <ActivityOverview totalsByType={yearData.totalsByType} selectedTypes={selectedTypes} filteredTotal={filteredTotal} />
        </div>
      </div>

      {/* Timeline */}
      <div className="overflow-hidden rounded-[--radius-xl] border border-[rgba(15,23,42,0.07)]"
        style={{
          background: "linear-gradient(180deg, rgba(255,255,255,0.72) 0%, rgba(255,255,255,0.48) 100%)",
          boxShadow: "0 18px 50px rgba(15,23,42,0.05)",
          backdropFilter: "blur(18px)",
          WebkitBackdropFilter: "blur(18px)",
        }}>
        <div className="flex items-center justify-between px-5 py-4">
          <h3 className="text-sm font-semibold">活动明细</h3>
          {filteredEvents.length > 20 && (
            <button type="button" onClick={() => setTimelineOpen(!timelineOpen)}
              className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs text-[--color-text-muted] hover:bg-[--color-bg-hover] transition-colors">
              {timelineOpen ? "收起" : "展开全部"} <ChevronDown size={12} className={`transition-transform ${timelineOpen ? "rotate-180" : ""}`} />
            </button>
          )}
        </div>
        <div className="border-t border-[rgba(15,23,42,0.06)] px-5 py-5">
          <RichTimeline events={timelineToShow} />
        </div>
      </div>
    </section>
  )
}
