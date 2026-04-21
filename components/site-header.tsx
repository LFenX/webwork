"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { SettingsDialog } from "@/components/settings-dialog"
import type { SessionPayload } from "@/lib/session"
import { Users, LogOut, LogIn } from "lucide-react"

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
}

export function SiteHeader({ ownerName = "LFen", heroTagline = "", session }: SiteHeaderProps) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" })
    router.push("/login")
    router.refresh()
  }

  return (
    <header className="sticky top-0 z-50 border-b border-[--color-border] bg-[--color-bg-primary]/95 backdrop-blur-sm">
      <div className="max-w-[1200px] mx-auto px-6 flex items-center gap-6 h-12">
        <Link
          href="/"
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
              <Link
                href="/friends"
                className={cn(
                  "inline-flex items-center gap-1 px-2 py-1 rounded-[--radius-sm] text-sm transition-colors hover:no-underline",
                  pathname === "/friends"
                    ? "bg-[--color-text-primary] text-[--color-bg-surface]"
                    : "text-[--color-text-secondary] hover:bg-[--color-bg-hover]"
                )}
                title="好友"
              >
                <Users size={13} />
              </Link>
              <SettingsDialog ownerName={ownerName} heroTagline={heroTagline} />
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
