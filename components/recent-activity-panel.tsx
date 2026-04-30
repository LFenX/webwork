"use client"

import Image from "next/image"
import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { ArrowUpRight, Bot, CheckCheck, Globe2, MessageCircle, Radio, UsersRound } from "lucide-react"
import { readUserStorage, userStorageKey, writeUserStorage } from "@/lib/client-storage"

export type RecentActivityTone = "blue" | "green" | "amber" | "coral"

export type RecentActivityItem = {
  id: string
  title: string
  description: string
  href: string
  meta: string
  time: string
  badge: string
  tone: RecentActivityTone
  channelId?: string
  channelTotalCount?: number
  variant?: "default" | "sticker-bundle"
  stickers?: Array<{
    id: string
    name: string
    url: string
    isAnimated: boolean
  }>
}

export type RecentActivityGroup = {
  key: string
  title: string
  subtitle: string
  href: string
  icon: "chat" | "friends" | "community" | "roundtable"
  pulse: string
  items: RecentActivityItem[]
}

const CHANNEL_SEEN_STORAGE_NAMESPACE = "channel-seen-count"
const CHANNEL_SEEN_STORAGE_ID = "channels"
const CHANNEL_SEEN_COUNTS_CHANGED_EVENT = "channel-seen-counts-changed"
const RECENT_ACTIVITY_SEEN_STORAGE_NAMESPACE = "recent-activity-seen"
const RECENT_ACTIVITY_SEEN_STORAGE_ID = "home"
const CHANNEL_SUMMARY_TTL_MS = 30 * 24 * 60 * 60 * 1000
const RECENT_ACTIVITY_SEEN_TTL_MS = 14 * 24 * 60 * 60 * 1000
const GROUP_ICONS = {
  chat: MessageCircle,
  friends: UsersRound,
  community: Globe2,
  roundtable: Bot,
}

function channelSeenStorageKey(userId: string) {
  return userStorageKey(userId, CHANNEL_SEEN_STORAGE_NAMESPACE, CHANNEL_SEEN_STORAGE_ID)
}

function recentActivitySeenStorageKey(userId: string) {
  return userStorageKey(userId, RECENT_ACTIVITY_SEEN_STORAGE_NAMESPACE, RECENT_ACTIVITY_SEEN_STORAGE_ID)
}

function itemTime(item: RecentActivityItem) {
  return new Date(item.time).getTime()
}

function relativeActivityTime(value: string) {
  const date = new Date(value)
  const diff = Date.now() - date.getTime()
  if (diff < 60_000) return "刚刚"
  if (diff < 3_600_000) return `${Math.max(1, Math.floor(diff / 60_000))} 分钟前`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`
  if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)} 天前`
  return date.toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" })
}

function persistReadActivities(items: RecentActivityItem[]) {
  const activityIds = items
    .map((item) => item.id)
    .filter((id) => /^(post|job|resume|website|sticker-bundle|roundtable)-/.test(id))
  if (activityIds.length === 0) return
  void fetch("/api/home/recent-activity/read", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ activityIds }),
  }).catch(() => null)
}

export function RecentActivityPanel({ groups, userId }: { groups: RecentActivityGroup[]; userId: string }) {
  const [liveGroups, setLiveGroups] = useState(groups)
  const [seenCounts, setSeenCounts] = useState<Record<string, number>>(() => {
    return readUserStorage<Record<string, number>>({
      kind: "local",
      key: channelSeenStorageKey(userId),
      userId,
      ttlMs: CHANNEL_SUMMARY_TTL_MS,
    }) ?? {}
  })
  const [seenActivityIds, setSeenActivityIds] = useState<Record<string, number>>(() => {
    return readUserStorage<Record<string, number>>({
      kind: "local",
      key: recentActivitySeenStorageKey(userId),
      userId,
      ttlMs: RECENT_ACTIVITY_SEEN_TTL_MS,
    }) ?? {}
  })

  const refreshRecentActivity = useCallback(async () => {
    const res = await fetch("/api/home/recent-activity", { cache: "no-store" }).catch(() => null)
    if (!res?.ok) return
    const data = await res.json().catch(() => ({}))
    if (Array.isArray(data.groups)) {
      setLiveGroups(data.groups as RecentActivityGroup[])
    }
  }, [])

  useEffect(() => {
    const onSeenChanged = (event: Event) => {
      const detail = (event as CustomEvent<Record<string, number>>).detail
      if (detail && typeof detail === "object") setSeenCounts(detail)
    }
    window.addEventListener(CHANNEL_SEEN_COUNTS_CHANGED_EVENT, onSeenChanged)
    return () => window.removeEventListener(CHANNEL_SEEN_COUNTS_CHANGED_EVENT, onSeenChanged)
  }, [userId])

  useEffect(() => {
    let refreshTimer: number | null = null
    const scheduleRefresh = () => {
      if (refreshTimer !== null) window.clearTimeout(refreshTimer)
      refreshTimer = window.setTimeout(() => {
        refreshTimer = null
        void refreshRecentActivity()
      }, 250)
    }

    const interval = window.setInterval(() => {
      void refreshRecentActivity()
    }, 12_000)
    window.addEventListener("app:realtime", scheduleRefresh)
    window.addEventListener("focus", scheduleRefresh)
    return () => {
      if (refreshTimer !== null) window.clearTimeout(refreshTimer)
      window.clearInterval(interval)
      window.removeEventListener("app:realtime", scheduleRefresh)
      window.removeEventListener("focus", scheduleRefresh)
    }
  }, [refreshRecentActivity])

  const visibleGroups = useMemo(() => {
    return liveGroups.map((group) => {
      return {
        ...group,
        items: group.items
          .map((item) => {
            if (seenActivityIds[item.id]) return null
            if (!item.channelId || typeof item.channelTotalCount !== "number") return item
            const seen = seenCounts[item.channelId] ?? 0
            const unread = Math.max(item.channelTotalCount - seen, 0)
            if (unread <= 0) return null
            return { ...item, badge: `${unread} 条新消息` }
          })
          .filter((item): item is RecentActivityItem => Boolean(item)),
      }
    }).filter((group) => group.items.length > 0)
  }, [liveGroups, seenActivityIds, seenCounts])

  const visibleItems = visibleGroups.flatMap((group) => group.items)
  const featured = visibleGroups
    .flatMap((group) => group.items.map((item) => ({ ...item, groupTitle: group.title })))
    .sort((a, b) => itemTime(b) - itemTime(a))[0]

  function markItemSeen(item: RecentActivityItem) {
    persistReadActivities([item])
    const nextSeenActivities = { ...seenActivityIds, [item.id]: 1 }
    setSeenActivityIds(nextSeenActivities)
    writeUserStorage({
      kind: "local",
      key: recentActivitySeenStorageKey(userId),
      userId,
      value: nextSeenActivities,
    })

    if (item.channelId && typeof item.channelTotalCount === "number") {
      const next = { ...seenCounts, [item.channelId]: item.channelTotalCount }
      setSeenCounts(next)
      writeUserStorage({
        kind: "local",
        key: channelSeenStorageKey(userId),
        userId,
        value: next,
      })
      window.dispatchEvent(new CustomEvent(CHANNEL_SEEN_COUNTS_CHANGED_EVENT, { detail: next }))
    }
  }

  function markAllSeen() {
    if (visibleItems.length === 0) return
    markItemsSeen(visibleItems)
  }

  function markGroupSeen(group: RecentActivityGroup) {
    if (group.items.length === 0) return
    markItemsSeen(group.items)
  }

  function markItemsSeen(items: RecentActivityItem[]) {
    persistReadActivities(items)
    const nextSeenActivities = { ...seenActivityIds }
    const nextSeenCounts = { ...seenCounts }
    items.forEach((item) => {
      nextSeenActivities[item.id] = 1
      if (item.channelId && typeof item.channelTotalCount === "number") {
        nextSeenCounts[item.channelId] = item.channelTotalCount
      }
    })
    setSeenActivityIds(nextSeenActivities)
    setSeenCounts(nextSeenCounts)
    writeUserStorage({
      kind: "local",
      key: recentActivitySeenStorageKey(userId),
      userId,
      value: nextSeenActivities,
    })
    writeUserStorage({
      kind: "local",
      key: channelSeenStorageKey(userId),
      userId,
      value: nextSeenCounts,
    })
    window.dispatchEvent(new CustomEvent(CHANNEL_SEEN_COUNTS_CHANGED_EVENT, { detail: nextSeenCounts }))
  }

  return (
    <section className="recent-activity-shell relative overflow-hidden rounded-[24px] border border-[rgba(37,99,235,0.14)] bg-[linear-gradient(135deg,rgba(255,255,255,0.94)_0%,rgba(239,246,255,0.88)_44%,rgba(255,250,240,0.92)_100%)] p-4 shadow-[0_22px_70px_rgba(37,99,235,0.12)] sm:p-5">
      <div className="recent-activity-sheen" />
      <div className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-[#2563eb]/10 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-14 left-1/4 h-36 w-36 rounded-full bg-[#c96442]/10 blur-2xl" />

      <div className="relative mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-[#2563eb]/15 bg-white/70 px-3 py-1 text-xs font-medium text-[#2563eb] shadow-sm backdrop-blur">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#2563eb] opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#2563eb]" />
            </span>
            Live Feed
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-xl font-semibold tracking-tight text-[--color-text-primary] sm:text-2xl">最近正在发生</h2>
            <Link href="/ai" className="soulwing-chat-link group inline-flex items-center gap-2 rounded-full border border-[#2563eb]/15 bg-white/78 py-1 pl-1 pr-3 text-sm font-semibold text-[#2563eb] shadow-sm transition-all hover:-translate-y-0.5 hover:border-[#2563eb]/30 hover:shadow-[0_12px_30px_rgba(37,99,235,0.16)] hover:no-underline">
              <span className="soulwing-butterfly-wrap relative inline-flex h-10 w-10 items-center justify-center">
                <span className="absolute inset-1 rounded-full bg-cyan-300/25 blur-md" />
                <Image src="/soulwing-butterfly.png" alt="" width={40} height={40} className="soulwing-butterfly relative object-contain" />
              </span>
              和蝶灵聊聊
              <ArrowUpRight size={14} className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </Link>
          </div>
          <p className="mt-1 text-sm text-[--color-text-secondary]">把聊天、好友、社区和蝶灵圆桌的新鲜事收拢在这里，一眼看到入口。</p>
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
          <button
            type="button"
            onClick={markAllSeen}
            disabled={visibleItems.length === 0}
            className="inline-flex items-center justify-center rounded-full border border-[#2563eb]/15 bg-white/80 px-3 py-1.5 text-xs font-semibold text-[#2563eb] shadow-sm transition-all hover:-translate-y-0.5 hover:border-[#2563eb]/30 hover:bg-white hover:shadow-[0_10px_26px_rgba(37,99,235,0.14)] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0 disabled:hover:shadow-sm"
          >
            一键已读全部动态
          </button>
          {visibleItems.length > 0 ? (
            <span className="text-[11px] text-[--color-text-muted]">当前 {visibleItems.length} 条未读动态</span>
          ) : null}
        </div>
        {featured && (
          <Link href={featured.href} onClick={() => markItemSeen(featured)} className="group flex min-w-0 items-center gap-3 rounded-2xl border border-white/70 bg-white/78 px-3 py-2 shadow-sm transition-all hover:-translate-y-0.5 hover:border-[#2563eb]/20 hover:shadow-[0_12px_34px_rgba(37,99,235,0.14)] hover:no-underline sm:max-w-[360px]">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#2563eb] text-white shadow-[0_8px_20px_rgba(37,99,235,0.28)]">
              <Radio size={16} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-medium text-[--color-text-muted]">{featured.groupTitle} · {relativeActivityTime(featured.time)}</span>
              <span className="block truncate text-sm font-semibold text-[--color-text-primary] group-hover:text-[#2563eb]">{featured.title}</span>
            </span>
            <ArrowUpRight size={15} className="shrink-0 text-[#2563eb] transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </Link>
        )}
      </div>

      <div className="relative grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {visibleGroups.map((group, groupIndex) => {
          const Icon = GROUP_ICONS[group.icon]
          return (
            <div key={group.key} className="group/activity relative min-w-0 overflow-hidden rounded-[18px] border border-white/70 bg-white/72 p-3 shadow-[0_10px_30px_rgba(15,23,42,0.06)] backdrop-blur transition-all duration-300 hover:-translate-y-1 hover:border-[#2563eb]/20 hover:bg-white/90 hover:shadow-[0_18px_46px_rgba(37,99,235,0.14)]">
              <div className="absolute inset-x-3 top-0 h-px bg-gradient-to-r from-transparent via-[#2563eb]/35 to-transparent opacity-0 transition-opacity group-hover/activity:opacity-100" />
              <div className="mb-3 flex items-start justify-between gap-3">
                <Link href={group.href} className="flex min-w-0 items-center gap-2 hover:no-underline">
                  <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[--color-brand-soft] text-[#2563eb]">
                    <span className={`absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full ${group.pulse} recent-activity-pulse`} />
                    <Icon size={18} />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-[--color-text-primary]">{group.title}</span>
                    <span className="block truncate text-xs text-[--color-text-muted]">{group.subtitle}</span>
                  </span>
                </Link>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => markGroupSeen(group)}
                    className="inline-flex h-7 items-center gap-1 rounded-full border border-[#2563eb]/10 bg-white/65 px-2 text-[11px] font-semibold text-[#2563eb] transition-colors hover:bg-[--color-brand-soft]"
                    title={`${group.title}全部已读`}
                  >
                    <CheckCheck size={12} />
                    已读
                  </button>
                  <Link href={group.href} className="rounded-full p-1.5 text-[--color-text-muted] transition-colors hover:bg-[--color-brand-soft] hover:text-[#2563eb]">
                    <ArrowUpRight size={14} />
                  </Link>
                </div>
              </div>

              <div className="max-h-[330px] space-y-2 overflow-y-auto pr-1">
                {group.items.map((item, itemIndex) => (
                    <Link
                      key={item.id}
                      href={item.href}
                      onClick={() => markItemSeen(item)}
                      className="recent-activity-item group/item block rounded-2xl border border-transparent bg-white/52 px-3 py-2.5 transition-all duration-200 hover:border-[#2563eb]/15 hover:bg-white hover:shadow-sm hover:no-underline"
                      style={{ animationDelay: `${(groupIndex * 3 + itemIndex) * 80}ms` }}
                    >
                      {item.variant === "sticker-bundle" && item.stickers?.length ? (
                        <span className="mb-2 grid grid-cols-4 gap-1.5">
                          {item.stickers.slice(0, 8).map((sticker) => (
                            <span key={sticker.id} className="flex aspect-square items-center justify-center overflow-hidden rounded-xl border border-white/70 bg-[--color-bg-hover]">
                              <Image
                                src={sticker.url}
                                alt={sticker.name}
                                width={52}
                                height={52}
                                unoptimized={sticker.isAnimated}
                                className="h-full w-full object-contain"
                              />
                            </span>
                          ))}
                        </span>
                      ) : null}
                      <div className="flex items-start gap-2.5">
                        <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${item.tone === "green" ? "bg-[#3a7d5c]" : item.tone === "amber" ? "bg-[#b8902d]" : item.tone === "coral" ? "bg-[#c96442]" : "bg-[#2563eb]"} shadow-[0_0_0_4px_rgba(37,99,235,0.08)]`} />
                        <span className="min-w-0 flex-1">
                          <span className="flex min-w-0 items-center justify-between gap-2">
                            <span className="truncate text-sm font-semibold text-[--color-text-primary] group-hover/item:text-[#2563eb]">{item.title}</span>
                            <span className="shrink-0 rounded-full bg-[--color-bg-hover] px-2 py-0.5 text-[10px] font-medium text-[--color-text-muted]">{item.badge}</span>
                          </span>
                          <span className="mt-1 line-clamp-2 text-xs leading-relaxed text-[--color-text-secondary]">{item.description}</span>
                          <span className="mt-2 flex items-center justify-between gap-2 text-[11px] text-[--color-text-muted]">
                            <span className="truncate">{item.meta}</span>
                            <span className="shrink-0">{relativeActivityTime(item.time)}</span>
                          </span>
                        </span>
                      </div>
                    </Link>
                  ))}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
