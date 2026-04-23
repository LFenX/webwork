"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { SettingsDialog } from "@/components/settings-dialog"
import { UserAvatar } from "@/components/user-avatar"
import { clearChatOutboxForUser } from "@/lib/chat-outbox"
import { clearUserLocalState } from "@/lib/client-storage"
import { Shield, Users, LogOut, LogIn } from "lucide-react"

const NAV_ITEMS = [
  { href: "/", label: "首页" },
  { href: "/resume", label: "简历" },
  { href: "/blog", label: "博客" },
  { href: "/daily", label: "日常" },
  { href: "/reflections", label: "心得" },
  { href: "/notes", label: "笔记" },
  { href: "/jobs", label: "求职" },
  { href: "/interviews", label: "面试" },
]

interface SiteHeaderProps {
  ownerName?: string
  heroTagline?: string
  session?: { userId: string; email: string } | null
  role?: string
  avatarText?: string | null
  avatarUrl?: string | null
  displayName?: string | null
}

export function SiteHeader({
  ownerName = "LFen",
  heroTagline = "",
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
    <header className="fixed inset-x-0 top-0 z-40 border-b border-[--color-border] bg-[--color-bg-primary]/95 backdrop-blur-sm">
      <div className="max-w-[1200px] mx-auto px-6 flex items-center gap-6 h-12">
        <Link
          href="/"
          prefetch={false}
          className="font-semibold text-[--color-text-primary] text-sm tracking-tight hover:no-underline shrink-0"
        >
          {ownerName}
        </Link>

        {session ? (
          <>
            <nav className="flex items-center gap-1 overflow-x-auto flex-1">
              {NAV_ITEMS.map((item) => {
                const isActive =
                  item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    prefetch={false}
                    className={cn(
                      "px-3 py-1 rounded-[--radius-sm] text-sm transition-colors duration-150 hover:no-underline whitespace-nowrap",
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

            <div className="flex items-center gap-2 shrink-0">
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
                  "relative inline-flex items-center gap-1 px-2 py-1 rounded-[--radius-sm] text-sm transition-colors hover:no-underline",
                  pathname === "/friends"
                    ? "bg-[--color-text-primary] text-[--color-bg-surface]"
                    : "text-[--color-text-secondary] hover:bg-[--color-bg-hover]"
                )}
                title="好友"
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
                    "inline-flex items-center gap-1 px-2 py-1 rounded-[--radius-sm] text-sm transition-colors hover:no-underline",
                    pathname === "/admin"
                      ? "bg-[--color-text-primary] text-[--color-bg-surface]"
                      : "text-[--color-text-secondary] hover:bg-[--color-bg-hover]"
                  )}
                  title="管理员"
                >
                  <Shield size={13} />
                </Link>
              )}
              <SettingsDialog ownerName={ownerName} heroTagline={heroTagline} email={session.email} />
              <button
                onClick={handleLogout}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-[--radius-sm] text-sm text-[--color-text-muted] hover:text-[--color-text-primary] hover:bg-[--color-bg-hover] transition-colors"
                title="退出登录"
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
              <LogIn size={13} /> 登录
            </Link>
          </>
        )}
      </div>
    </header>
  )
}
