"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

const NAV_ITEMS = [
  { href: "/", label: "首页" },
  { href: "/resume", label: "简历" },
  { href: "/blog", label: "博客" },
  { href: "/daily", label: "日常" },
  { href: "/reflections", label: "心得" },
  { href: "/jobs", label: "求职" },
  { href: "/interviews", label: "面试" },
]

export function SiteHeader() {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-50 border-b border-[--color-border] bg-[--color-bg-primary]/95 backdrop-blur-sm">
      <div className="max-w-[1200px] mx-auto px-6 flex items-center gap-6 h-12">
        <Link
          href="/"
          className="font-semibold text-[--color-text-primary] text-sm tracking-tight hover:no-underline shrink-0"
        >
          My Space
        </Link>
        <nav className="flex items-center gap-1 overflow-x-auto">
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href)
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
      </div>
    </header>
  )
}
