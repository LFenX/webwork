"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import {
  BookOpen, Briefcase, Calendar, Database, FileText, Globe, GraduationCap, Home, Lightbulb,
  LogIn, LogOut, Menu, Settings, Shield,
  Sparkles, StickyNote, Users, Video, X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { UserAvatar } from "@/components/user-avatar"
import { HeaderAnnouncementTicker } from "@/components/header-announcement-ticker"
import { clearChatOutboxForUser } from "@/lib/chat-outbox"
import { clearUserLocalState, readUserStorage, userStorageKey, writeUserStorage } from "@/lib/client-storage"
import { getActiveChatContext, subscribeActiveChatContext } from "@/lib/active-chat"
import type { AppLocale } from "@/lib/i18n"

// Shared nav config with icons for desktop and mobile
const NAV_ICONS: Record<string, React.ReactNode> = {
  "/": <Home size={16} />,
  "/community": <Globe size={16} />,
  "/resume": <FileText size={16} />,
  "/blog": <BookOpen size={16} />,
  "/daily": <Calendar size={16} />,
  "/reflections": <Lightbulb size={16} />,
  "/notes": <StickyNote size={16} />,
  "/jobs": <Briefcase size={16} />,
  "/interviews": <Video size={16} />,
  "/ai": <Sparkles size={16} />,
  "/sql": <Database size={16} />,
  "/sql-practice": <GraduationCap size={16} />,
  "/friends": <Users size={16} />,
  "/admin": <Shield size={16} />,
  "/settings": <Settings size={16} />,
}

interface SiteHeaderProps {
  ownerName?: string
  heroTagline?: string
  locale: AppLocale
  navDict: {
    home: string
    community: string
    resume: string
    blog: string
    daily: string
    reflections: string
    notes: string
    jobs: string
    interviews: string
    ai: string
    sql: string
    sqlPractice: string
    friends: string
    admin: string
    login: string
    logout: string
    settings: string
  }
  session?: { userId: string; email: string } | null
  role?: string
  avatarText?: string | null
  avatarUrl?: string | null
  displayName?: string | null
  canAccessSqlPractice?: boolean
}

export function SiteHeader({
  ownerName = "LFen",
  heroTagline = "",
  locale,
  navDict,
  session,
  role = "user",
  avatarText,
  avatarUrl,
  displayName,
  canAccessSqlPractice = false,
}: SiteHeaderProps) {
  const pathname = usePathname()
  const [presenceStatus, setPresenceStatus] = useState<"online" | "away" | "offline">(session ? "online" : "offline")
  const [friendUnreadCount, setFriendUnreadCount] = useState(0)
  const [channelUnreadCount, setChannelUnreadCount] = useState(0)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const visibleFriendUnreadCount = session ? friendUnreadCount + channelUnreadCount : 0

  const navItems = [
    { href: "/", label: navDict.home },
    { href: "/community", label: navDict.community },
    { href: "/resume", label: navDict.resume },
    { href: "/blog", label: navDict.blog },
    { href: "/daily", label: navDict.daily },
    { href: "/reflections", label: navDict.reflections },
    { href: "/notes", label: navDict.notes },
    { href: "/jobs", label: navDict.jobs },
    { href: "/interviews", label: navDict.interviews },
    { href: "/ai", label: navDict.ai },
    { href: "/sql", label: navDict.sql },
    ...(canAccessSqlPractice ? [{ href: "/sql-practice", label: navDict.sqlPractice }] : []),
  ]

  useEffect(() => {
    const onPresence = (event: Event) => {
      const status = (event as CustomEvent).detail
      if (status === "online" || status === "away" || status === "offline") setPresenceStatus(status)
    }
    window.addEventListener("session-presence", onPresence)
    return () => window.removeEventListener("session-presence", onPresence)
  }, [])

  useEffect(() => {
    if (!session) return
    let cancelled = false
    async function refreshUnread() {
      const activeContext = getActiveChatContext()
      const params = new URLSearchParams({ _t: String(Date.now()) })
      if (activeContext?.kind === "direct") params.set("activeFriendId", activeContext.id)
      const res = await fetch(`/api/chats/summary?${params.toString()}`, { cache: "no-store" }).catch(() => null)
      if (!res?.ok) return
      const data = await res.json().catch(() => null)
      if (cancelled) return
      const items = Array.isArray(data?.items) ? data.items : []
      setFriendUnreadCount(items.reduce((sum: number, item: { unreadCount?: number }) => sum + Math.max(0, Number(item.unreadCount) || 0), 0))
    }
    void refreshUnread()
    window.addEventListener("chat-unread-refresh", refreshUnread)
    const unsubscribe = subscribeActiveChatContext(() => {
      void refreshUnread()
    })
    return () => {
      cancelled = true
      window.removeEventListener("chat-unread-refresh", refreshUnread)
      unsubscribe()
    }
  }, [session])

  useEffect(() => {
    if (!session) return
    let cancelled = false
    const userId = session.userId
    const storageKey = userStorageKey(userId, "channel-seen-count", "channels")
    async function refreshChannelUnread() {
      const res = await fetch(`/api/channels/summary?_t=${Date.now()}`, { cache: "no-store" }).catch(() => null)
      if (!res?.ok) return
      const data = await res.json().catch(() => null)
      if (cancelled) return
      const items = Array.isArray(data?.items) ? data.items as Array<{ channelId: string; totalCount: number }> : []
      let seen = readUserStorage<Record<string, number>>({
        kind: "local",
        key: storageKey,
        userId,
        ttlMs: 30 * 24 * 60 * 60 * 1000,
      })
      if (!seen) {
        seen = Object.fromEntries(items.map((item) => [item.channelId, item.totalCount]))
        writeUserStorage({ kind: "local", key: storageKey, userId, value: seen })
      }
      setChannelUnreadCount(items.reduce((sum, item) => {
        if (item.channelId === "soulwing-roundtable") return sum
        return sum + Math.max(0, item.totalCount - (seen?.[item.channelId] ?? item.totalCount))
      }, 0))
    }
    void refreshChannelUnread()
    const onSeen = () => void refreshChannelUnread()
    const onRealtime = (event: Event) => {
      const payload = (event as CustomEvent).detail
      if (payload?.type === "channel:message") void refreshChannelUnread()
    }
    window.addEventListener("channel-seen-counts-changed", onSeen)
    window.addEventListener("app:realtime", onRealtime)
    return () => {
      cancelled = true
      window.removeEventListener("channel-seen-counts-changed", onSeen)
      window.removeEventListener("app:realtime", onRealtime)
    }
  }, [session])

  async function handleLogout() {
    if (session?.userId) {
      clearUserLocalState(session.userId)
      await clearChatOutboxForUser(session.userId)
    }
    await fetch("/api/auth/logout", {
      method: "POST",
      cache: "no-store",
    }).catch(() => null)
    window.location.replace("/login")
  }

  return (
    <>
    <header
      data-locale={locale}
      className="site-header fixed inset-x-0 top-0 z-50 bg-transparent px-3 pt-2 sm:px-4"
    >
      <div className="mx-auto flex h-12 max-w-[1760px] items-center gap-4 rounded-[14px] border border-slate-200/80 bg-white/90 px-4 shadow-[0_10px_30px_rgba(15,23,42,0.08)] backdrop-blur-[18px] [-webkit-backdrop-filter:blur(18px)] sm:px-5 lg:gap-6">
        {/* Desktop: brand name; Mobile: menu button */}
        <Link
          href="/"
          prefetch={false}
          className="hidden shrink-0 text-sm font-semibold tracking-tight text-[--color-text-primary] hover:no-underline md:block"
          title={heroTagline}
        >
          {ownerName}
        </Link>
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[--color-bg-hover] text-[--color-text-secondary] transition-colors hover:bg-[--color-brand-soft] hover:text-[--color-brand] md:hidden"
          aria-label="打开菜单"
        >
          <Menu size={18} />
        </button>
        {session && <HeaderAnnouncementTicker enabled compact className="flex-1 md:hidden" />}

        {session ? (
          <>
            <nav className="hidden min-w-0 max-w-[920px] shrink items-center gap-1 overflow-x-auto md:flex">
              {navItems.map((item) => {
                const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    prefetch={false}
                    className={cn(
                      "inline-flex items-center h-[34px] whitespace-nowrap rounded-full px-3 text-sm transition-all duration-200 hover:no-underline",
                      isActive
                        ? "bg-[--color-brand] text-white shadow-[0_8px_22px_rgba(37,99,235,0.22)]"
                        : "text-[--color-text-secondary] hover:bg-[--color-brand-soft] hover:text-[--color-brand] hover:-translate-y-px"
                    )}
                  >
                    {item.label}
                  </Link>
                )
              })}
            </nav>

            <HeaderAnnouncementTicker enabled className="hidden min-w-0 flex-1 lg:block" />

            <div className="flex shrink-0 items-center gap-1.5">
              <Link href="/" prefetch={false} className="hover:no-underline" title={displayName || session.email}>
                <UserAvatar
                  size="sm"
                  name={displayName || ownerName}
                  email={session.email}
                  avatarText={avatarText}
                  avatarUrl={avatarUrl}
                  presenceStatus={presenceStatus}
                />
              </Link>
              <Link
                href="/friends"
                prefetch={false}
                className={cn(
                  "relative inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-sm transition-all duration-200 hover:no-underline",
                  pathname.startsWith("/friends")
                    ? "bg-[--color-brand] text-white shadow-[0_8px_22px_rgba(37,99,235,0.22)]"
                    : "text-[--color-text-secondary] hover:bg-[--color-brand-soft] hover:text-[--color-brand]"
                )}
                title={navDict.friends}
              >
                <Users size={14} />
                {visibleFriendUnreadCount > 0 && (
                  <span className="absolute -right-1.5 -top-1.5 min-w-4 rounded-full bg-red-500 px-1 text-center font-mono text-[10px] leading-4 text-white">
                    {visibleFriendUnreadCount > 99 ? "99+" : visibleFriendUnreadCount}
                  </span>
                )}
              </Link>
              {(role === "owner" || role === "admin") && (
                <Link
                  href="/admin"
                  prefetch={false}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-sm transition-all duration-200 hover:no-underline",
                    pathname === "/admin"
                      ? "bg-[--color-brand] text-white shadow-[0_8px_22px_rgba(37,99,235,0.22)]"
                      : "text-[--color-text-secondary] hover:bg-[--color-brand-soft] hover:text-[--color-brand]"
                  )}
                  title={navDict.admin}
                >
                  <Shield size={14} />
                </Link>
              )}
              <Link
                href="/settings"
                prefetch={false}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-sm transition-all duration-200 hover:no-underline",
                  pathname.startsWith("/settings")
                    ? "bg-[--color-brand] text-white shadow-[0_8px_22px_rgba(37,99,235,0.22)]"
                    : "text-[--color-text-muted] hover:bg-[--color-brand-soft] hover:text-[--color-brand]"
                )}
                title={navDict.settings}
              >
                <Settings size={14} />
              </Link>
              <button
                onClick={handleLogout}
                className="inline-flex items-center gap-1 rounded-full px-2 py-2 text-sm text-[--color-text-muted] transition-colors hover:bg-red-50 hover:text-red-600"
                title={navDict.logout}
              >
                <LogOut size={14} />
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex-1" />
            <Link
              href="/login"
              prefetch={false}
              className="inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm text-[--color-text-secondary] transition-colors hover:bg-[--color-brand-soft] hover:text-[--color-brand] hover:no-underline"
            >
              <LogIn size={14} /> {navDict.login}
            </Link>
          </>
        )}
      </div>
    </header>

    {/* Mobile sidebar */}
    {sidebarOpen && (
      <div className="fixed inset-0 z-[60] md:hidden">
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/20 backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
        {/* Panel */}
        <div className="absolute inset-y-0 left-0 flex w-[min(82vw,300px)] flex-col border-r border-[rgba(15,23,42,0.08)] bg-[rgba(255,255,255,0.82)] shadow-[0_18px_50px_rgba(15,23,42,0.12)] backdrop-blur-[24px] [-webkit-backdrop-filter:blur(24px)] animate-in slide-in-from-left duration-200">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[rgba(15,23,42,0.06)] px-5 py-4">
            <div className="flex items-center gap-3">
              {session && (
                <UserAvatar
                  size="sm"
                  name={displayName || ownerName}
                  email={session.email}
                  avatarText={avatarText}
                  avatarUrl={avatarUrl}
                  presenceStatus={presenceStatus}
                />
              )}
              <span className="text-sm font-semibold text-[--color-text-primary]">
                {displayName || ownerName}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[--color-text-muted] hover:bg-[--color-bg-hover] hover:text-[--color-text-primary]"
              aria-label="关闭菜单"
            >
              <X size={18} />
            </button>
          </div>

          {/* Nav items */}
          <div className="flex-1 overflow-y-auto px-3 py-4">
            <nav className="space-y-1">
              {navItems.map((item) => {
                const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    prefetch={false}
                    onClick={() => setSidebarOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-[12px] px-4 py-3 text-sm font-medium transition-all duration-150 hover:no-underline",
                      isActive
                        ? "bg-[--color-brand-soft] text-[--color-brand]"
                        : "text-[--color-text-secondary] hover:bg-[--color-bg-hover] hover:text-[--color-text-primary]"
                    )}
                  >
                    <span className={isActive ? "text-[--color-brand]" : "text-[--color-text-muted]"}>
                      {NAV_ICONS[item.href]}
                    </span>
                    {item.label}
                  </Link>
                )
              })}
            </nav>

            {/* Secondary links */}
            {session ? (
              <div className="mt-6 border-t border-[rgba(15,23,42,0.06)] pt-4 space-y-1">
                <Link
                  href="/friends"
                  prefetch={false}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-[12px] px-4 py-3 text-sm font-medium transition-all duration-150 hover:no-underline",
                    pathname === "/friends"
                      ? "bg-[--color-brand-soft] text-[--color-brand]"
                      : "text-[--color-text-secondary] hover:bg-[--color-bg-hover] hover:text-[--color-text-primary]"
                  )}
                >
                  <Users size={16} className={pathname === "/friends" ? "text-[--color-brand]" : "text-[--color-text-muted]"} />
                  好友
                  {visibleFriendUnreadCount > 0 && (
                    <span className="ml-auto min-w-5 rounded-full bg-red-500 px-1.5 text-center text-[10px] leading-5 text-white">
                      {visibleFriendUnreadCount > 99 ? "99+" : visibleFriendUnreadCount}
                    </span>
                  )}
                </Link>
                {(role === "owner" || role === "admin") && (
                  <Link
                    href="/admin"
                    prefetch={false}
                    onClick={() => setSidebarOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-[12px] px-4 py-3 text-sm font-medium transition-all duration-150 hover:no-underline",
                      pathname === "/admin"
                        ? "bg-[--color-brand-soft] text-[--color-brand]"
                        : "text-[--color-text-secondary] hover:bg-[--color-bg-hover] hover:text-[--color-text-primary]"
                    )}
                  >
                    <Shield size={16} className={pathname === "/admin" ? "text-[--color-brand]" : "text-[--color-text-muted]"} />
                    管理
                  </Link>
                )}
                <Link
                  href="/settings"
                  prefetch={false}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-[12px] px-4 py-3 text-sm font-medium transition-all duration-150 hover:no-underline",
                    pathname.startsWith("/settings")
                      ? "bg-[--color-brand-soft] text-[--color-brand]"
                      : "text-[--color-text-secondary] hover:bg-[--color-bg-hover] hover:text-[--color-text-primary]"
                  )}
                >
                  <Settings size={16} className={pathname.startsWith("/settings") ? "text-[--color-brand]" : "text-[--color-text-muted]"} />
                  设置
                </Link>
                <button
                  type="button"
                  onClick={() => { setSidebarOpen(false); handleLogout() }}
                  className="flex w-full items-center gap-3 rounded-[12px] px-4 py-3 text-sm font-medium text-[--color-text-muted] transition-colors hover:bg-red-50 hover:text-red-600"
                >
                  <LogOut size={16} />
                  退出登录
                </button>
              </div>
            ) : (
              <div className="mt-6 border-t border-[rgba(15,23,42,0.06)] pt-4">
                <Link
                  href="/login"
                  prefetch={false}
                  onClick={() => setSidebarOpen(false)}
                  className="flex items-center gap-3 rounded-[12px] px-4 py-3 text-sm font-medium text-[--color-text-secondary] transition-colors hover:bg-[--color-brand-soft] hover:text-[--color-brand] hover:no-underline"
                >
                  <LogIn size={16} />
                  登录
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    )}
  </>
)}
