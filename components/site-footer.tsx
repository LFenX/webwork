import { formatChinaDate } from "@/lib/time"

export function SiteFooter() {
  const year = new Date().getFullYear()
  return (
    <footer className="mt-auto border-t border-[--color-border] bg-[--color-bg-primary]">
      <div className="max-w-[1200px] mx-auto px-6 py-4 flex items-center justify-between text-xs text-[--color-text-muted]">
        <span>© {year} My Space</span>
        <span className="font-mono">Last updated {formatChinaDate(new Date())} by LFen</span>
      </div>
    </footer>
  )
}
