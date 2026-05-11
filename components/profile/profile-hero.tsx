import Link from "next/link"
import { ArrowLeft, Edit3, Mail, MapPin, MessageSquareText, PenLine, Settings } from "lucide-react"
import type { ElementType } from "react"
import { Button } from "@/components/ui/button"
import { UserAvatar } from "@/components/user-avatar"
import { cn } from "@/lib/utils"

type ProfileAction = {
  label: string
  href: string
  icon?: ElementType
  variant?: "primary" | "secondary" | "ghost"
}

type ProfileHeroProps = {
  name: string
  email?: string | null
  bio?: string | null
  location?: string | null
  avatarText?: string | null
  avatarUrl?: string | null
  status?: string
  eyebrow?: string
  backHref?: string
  backLabel?: string
  actions?: ProfileAction[]
  className?: string
}

const DEFAULT_ACTION_ICONS: Record<string, ElementType> = {
  编辑资料: Edit3,
  写文章: PenLine,
  管理: Settings,
  留言: MessageSquareText,
}

export function ProfileHero({
  name,
  email,
  bio,
  location,
  avatarText,
  avatarUrl,
  status,
  eyebrow = "个人主页",
  backHref,
  backLabel,
  actions = [],
  className,
}: ProfileHeroProps) {
  return (
    <header className={cn("mb-5 flex flex-col gap-3", className)}>
      {backHref && backLabel && (
        <Link
          href={backHref}
          className="inline-flex min-h-10 w-fit items-center gap-1.5 rounded-full px-3 text-sm font-medium text-[--color-text-secondary] transition-colors hover:bg-[--color-brand-soft] hover:text-[--color-brand] hover:no-underline"
        >
          <ArrowLeft size={15} />
          {backLabel}
        </Link>
      )}

      <div className="relative overflow-hidden rounded-[28px] border border-[--color-border] bg-[linear-gradient(135deg,rgba(255,255,255,0.94)_0%,rgba(245,249,255,0.9)_52%,rgba(255,255,255,0.78)_100%)] px-4 py-5 shadow-[--shadow-profile-hero] backdrop-blur-xl sm:px-6 sm:py-6">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[--color-brand-border] to-transparent" />
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center">
            <UserAvatar
              size="xl"
              name={name}
              email={email}
              avatarText={avatarText}
              avatarUrl={avatarUrl}
              className="drop-shadow-[0_14px_32px_rgba(15,23,42,0.13)]"
            />
            <div className="min-w-0">
              <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-[--color-text-muted]">{eyebrow}</p>
              <h1 className="text-2xl font-semibold tracking-tight text-[--color-text-primary] sm:text-3xl">{name}</h1>
              {bio ? (
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[--color-text-secondary] sm:text-base">{bio}</p>
              ) : (
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[--color-text-muted]">这个主页正在慢慢生长，先从内容、日常和交流开始。</p>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[--color-text-muted] sm:text-sm">
                {email && (
                  <span className="inline-flex min-h-8 max-w-full items-center gap-1.5 rounded-full border border-[--color-border] bg-white/58 px-3">
                    <Mail size={14} />
                    <span className="break-all">{email}</span>
                  </span>
                )}
                {location && (
                  <span className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-[--color-border] bg-white/58 px-3">
                    <MapPin size={14} />
                    {location}
                  </span>
                )}
                {status && (
                  <span className="inline-flex min-h-8 items-center rounded-full border border-[--color-brand-border] bg-[--color-brand-soft] px-3 font-medium text-[--color-brand]">
                    {status}
                  </span>
                )}
              </div>
            </div>
          </div>

          {actions.length > 0 && (
            <div className="flex shrink-0 flex-wrap gap-2 md:justify-end">
              {actions.map((action) => {
                const Icon = action.icon ?? DEFAULT_ACTION_ICONS[action.label]
                const variant = action.variant === "primary" ? "default" : action.variant === "ghost" ? "ghost" : "outline"
                return (
                  <Button key={`${action.href}-${action.label}`} asChild variant={variant} size="sm">
                    <Link href={action.href}>
                      {Icon ? <Icon data-icon="inline-start" /> : null}
                      {action.label}
                    </Link>
                  </Button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
