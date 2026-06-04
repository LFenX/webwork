"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { getDict } from "@/lib/i18n"
import { formatChinaDate } from "@/lib/time"
import { cn } from "@/lib/utils"

export function SiteFooter() {
  const pathname = usePathname()
  const dict = getDict()
  const year = new Date().getFullYear()
  const today = formatChinaDate(new Date())
  const isHomePage = pathname === "/"
  const isAppLikePage = pathname === "/friends" || pathname.startsWith("/friends/") || pathname === "/sql" || pathname === "/updates"

  return (
    <footer className={cn("site-footer mt-auto bg-transparent px-4 pb-4 pt-2 sm:px-6 lg:px-12 xl:px-16", !isHomePage && "hidden sm:block", isAppLikePage && "!hidden")}>
      <div className="mx-auto flex min-h-12 max-w-[1760px] flex-col items-center justify-between gap-2 rounded-[14px] border border-slate-200/80 bg-white/85 px-4 py-3 text-xs text-slate-500 shadow-[0_10px_30px_rgba(15,23,42,0.06)] backdrop-blur-[18px] [-webkit-backdrop-filter:blur(18px)] sm:flex-row sm:px-5">
        <span className="font-medium">&copy; {year} My Space</span>
        <Link
          href="/updates"
          className="inline-flex min-h-8 items-center gap-2 rounded-full px-3 font-mono font-medium text-blue-600 transition-colors hover:bg-blue-50 hover:no-underline"
        >
          <span>{dict.nav.updates}</span>
          <span aria-hidden="true" className="text-slate-300">/</span>
          <span>{today}</span>
        </Link>
      </div>
    </footer>
  )
}
