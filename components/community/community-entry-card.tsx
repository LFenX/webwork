import Link from "next/link"
import { ArrowRight } from "lucide-react"

interface CommunityEntryCardProps {
  icon: React.ReactNode
  title: string
  subtitle?: string
  description: string
  href: string
  badges?: { icon?: React.ReactNode; label: string }[]
  cta?: string
  large?: boolean
}

export function CommunityEntryCard({
  icon, title, subtitle, description, href, badges, cta, large,
}: CommunityEntryCardProps) {
  return (
    <Link
      href={href}
      prefetch={false}
      className={`group block rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface] p-6 transition-all duration-200 hover:border-[--color-brand-border] hover:shadow-[--shadow-md] hover:-translate-y-0.5 hover:no-underline ${large ? "lg:col-span-3" : ""}`}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[--color-brand-soft] transition-colors group-hover:bg-[--color-brand]">
        <span className="text-[--color-brand] transition-colors group-hover:text-white">
          {icon}
        </span>
      </div>
      <h2 className={`mt-4 font-semibold text-[--color-text-primary] ${large ? "text-xl" : "text-lg"}`}>
        {title}
      </h2>
      {subtitle && (
        <p className="mt-1 text-sm text-[--color-text-secondary]">{subtitle}</p>
      )}
      <p className={`text-xs text-[--color-text-muted] ${badges?.length ? "mt-1" : "mt-2"}`}>
        {description}
      </p>
      {badges && badges.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {badges.map((b) => (
            <span key={b.label} className="inline-flex items-center gap-1.5 rounded-full bg-[--color-bg-hover] px-3 py-1.5 text-xs text-[--color-text-secondary]">
              {b.icon}
              {b.label}
            </span>
          ))}
        </div>
      )}
      {cta && (
        <div className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-[--color-brand] transition-transform group-hover:translate-x-1">
          {cta}
          <ArrowRight size={14} />
        </div>
      )}
    </Link>
  )
}
