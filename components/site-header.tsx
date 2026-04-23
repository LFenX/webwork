"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { Settings, Shield, Users, LogOut, LogIn } from "lucide-react"
import { cn } from "@/lib/utils"
import { UserAvatar } from "@/components/user-avatar"
import { clearChatOutboxForUser } from "@/lib/chat-outbox"
import { clearUserLocalState } from "@/lib/client-storage"
import type { AppLocale } from "@/lib/i18n"

interface SiteHeaderProps {
  ownerName?: string
  heroTagline?: string
  locale: AppLocale
  navDict: {
    home: string
    resume: string
    blog: string
    daily: string
    reflections: string
    notes: string
    jobs: string
    interviews: string
    ai: string
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
}: SiteHeaderProps) {
  const pathname = usePathname()
  const [presenceStatus, setPresenceStatus] = useState<"online" | "away" | "offline">(session ? "online" : "offline")
  const [friendUnreadCount, setFriendUnreadCount] = useState(0)
  const visibleFriendUnreadCount = session ? friendUnreadCount : 0

  const navItems = [
    { href: "/", label: navDict.home },
    { href: "/resume", label: navDict.resume },
    { href: "/blog", label: navDict.blog },
    { href: "/daily", label: navDict.daily },
    { href: "/reflections", label: navDict.reflections },
    { href: "/notes", label: navDict.notes },
    { href: "/jobs", label: navDict.jobs },
    { href: "/interviews", label: navDict.interviews },
    { href: "/ai", label: navDict.ai },
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
      const res = await fetch(`/api/chats/summary?_t=${Date.now()}`, { cache: "no-store" }).catch(() => null)
      if (!res?.ok) return
      const data = await res.json().catch(() => null)
      if (cancelled) return
      const items = Array.isArray(data?.items) ? data.items : []
      setFriendUnreadCount(items.reduce((sum: number, item: { unreadCount?: number }) => sum + Math.max(0, Number(item.unreadCount) || 0), 0))
    }
    void refreshUnread()
    window.addEventListener("chat-unread-refresh", refreshUnread)
    return () => {
      cancelled = true
      window.removeEventListener("chat-unread-refresh", refreshUnread)
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
    <header data-locale={locale} className="fixed inset-x-0 top-0 z-40 border-b border-[--color-border] bg-[--color-bg-primary]/95 backdrop-blur-sm">
      <div className="mx-auto flex h-12 max-w-[1200px] items-center gap-6 px-6">
        <Link
          href="/"
          prefetch={false}
          className="shrink-0 text-sm font-semibold tracking-tight text-[--color-text-primary] hover:no-underline"
          title={heroTagline}
        >
          {ownerName}
        </Link>

        {session ? (
          <>
            <nav className="flex flex-1 items-center gap-1 overflow-x-auto">
              {navItems.map((item) => {
                const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    prefetch={false}
                    className={cn(
                      "whitespace-nowrap rounded-[--radius-sm] px-3 py-1 text-sm transition-colors duration-150 hover:no-underline",
                      isActive
                        ? "bg-[--color-text-primary] text-[--color-bg-surface]"
                        : "text-[--color-text-secondary] hover:bg-[--color-bg-hover] hover:text-[--color-text-primary]"
                    )}
                  >
                    {item.label}
                  </Link>
                )
              })}
            </nav>

            <div className="flex shrink-0 items-center gap-2">
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
                  "relative inline-flex items-center gap-1 rounded-[--radius-sm] px-2 py-1 text-sm transition-colors hover:no-underline",
                  pathname === "/friends"
                    ? "bg-[--color-text-primary] text-[--color-bg-surface]"
                    : "text-[--color-text-secondary] hover:bg-[--color-bg-hover]"
                )}
                title={navDict.friends}
              >
                <Users size={13} />
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
                    "inline-flex items-center gap-1 rounded-[--radius-sm] px-2 py-1 text-sm transition-colors hover:no-underline",
                    pathname === "/admin"
                      ? "bg-[--color-text-primary] text-[--color-bg-surface]"
                      : "text-[--color-text-secondary] hover:bg-[--color-bg-hover]"
                  )}
                  title={navDict.admin}
                >
                  <Shield size={13} />
                </Link>
              )}
              <Link
                href="/settings"
                prefetch={false}
                className={cn(
                  "inline-flex items-center gap-1 rounded-[--radius-sm] px-2 py-1 text-sm transition-colors hover:no-underline",
                  pathname.startsWith("/settings")
                    ? "bg-[--color-text-primary] text-[--color-bg-surface]"
                    : "text-[--color-text-muted] hover:bg-[--color-bg-hover] hover:text-[--color-text-primary]"
                )}
                title={navDict.settings}
              >
                <Settings size={13} />
              </Link>
              <button
                onClick={handleLogout}
                className="inline-flex items-center gap-1 rounded-[--radius-sm] px-2 py-1 text-sm text-[--color-text-muted] transition-colors hover:bg-[--color-bg-hover] hover:text-[--color-text-primary]"
                title={navDict.logout}
              >
                <LogOut size={13} />
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex-1" />
            <Link
              href="/login"
              prefetch={false}
              className="inline-flex items-center gap-1.5 px-3 py-1 text-sm text-[--color-text-secondary] hover:text-[--color-text-primary] hover:no-underline"
            >
              <LogIn size={13} /> {navDict.login}
            </Link>
          </>
        )}
      </div>
    </header>
  )
}
