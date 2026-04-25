"use client"

import Link from "next/link"
import { getDict } from "@/lib/i18n"
import { formatChinaDate } from "@/lib/time"

export function SiteFooter() {
  const dict = getDict()
  const year = new Date().getFullYear()

  return (
    <footer className="mt-auto border-t border-[--color-border] bg-[--color-bg-primary]">
      <div className="mx-auto flex max-w-[1200px] items-center justify-between px-6 py-4 text-xs text-[--color-text-muted]">
        <span>© {year} My Space</span>
        <Link href="/updates" className="font-mono hover:text-[--color-text-primary] hover:no-underline">
          {dict.nav.updates} — {formatChinaDate(new Date())}
        </Link>
      </div>
    </footer>
  )
}
