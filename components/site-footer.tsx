import { formatChinaDate } from "@/lib/time"
import Link from "next/link"

export function SiteFooter() {
  const year = new Date().getFullYear()
  return (
    <footer className="mt-auto border-t border-[--color-border] bg-[--color-bg-primary]">
      <div className="max-w-[1200px] mx-auto px-6 py-4 flex items-center justify-between text-xs text-[--color-text-muted]">
        <span>© {year} My Space</span>
        <Link href="/updates" className="font-mono hover:text-[--color-text-primary] hover:no-underline">
          Last updated {formatChinaDate(new Date())} by LFen
        </Link>
      </div>
    </footer>
  )
}
