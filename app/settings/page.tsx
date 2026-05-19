import Link from "next/link"
import {
  ArrowUpRight,
  BookOpen,
  Eye,
  Globe2,
  LayoutDashboard,
  Lock,
  Sparkles,
  UserRound,
} from "lucide-react"
import { requireAuth } from "@/lib/auth"
import { getDictionary } from "@/lib/i18n"
import { getUserSiteSettings } from "@/lib/settings"
import { SettingsShell } from "@/components/settings/settings-shell"

export const dynamic = "force-dynamic"

type SettingsItem = {
  href: string
  title: string
  description: string
  icon: React.ReactNode
  accent: string
  external?: boolean
}

export default async function SettingsPage() {
  const session = await requireAuth()
  const settings = await getUserSiteSettings(session.userId)
  const dict = getDictionary(settings.language)

  const en = settings.language === "en-US"

  const items: SettingsItem[] = [
    {
      href: "/settings/profile",
      title: dict.settings.profile,
      description: dict.settings.profileDesc,
      icon: <UserRound size={18} />,
      accent: "from-[#dbe7ff] to-[#eef3ff]",
    },
    {
      href: "/settings/password",
      title: dict.settings.password,
      description: dict.settings.passwordDesc,
      icon: <Lock size={18} />,
      accent: "from-[#fde7ec] to-[#fff2f5]",
    },
    {
      href: "/settings/privacy",
      title: dict.settings.privacy,
      description: dict.settings.privacyDesc,
      icon: <Eye size={18} />,
      accent: "from-[#e6f4ec] to-[#f1faf3]",
    },
    {
      href: "/settings/language",
      title: dict.settings.language,
      description: dict.settings.languageDesc,
      icon: <Globe2 size={18} />,
      accent: "from-[#f0eaff] to-[#f7f3ff]",
    },
    {
      href: "/settings/live2d",
      title: en ? "Live2D companion" : "Live2D 看板娘",
      description: en
        ? "Toggle and position your Live2D desktop character, switch models and bubble themes."
        : "开启或关闭桌面看板娘，切换模型、气泡主题和昵称。",
      icon: <Sparkles size={18} />,
      accent: "from-[#ffe9ec] to-[#fff1f4]",
    },
    {
      href: "/?layout=edit",
      title: dict.home.editLayout,
      description: en
        ? "Go back home to adjust card order, width, and visibility."
        : "回到首页调整卡片排序、宽度和显示状态。",
      icon: <LayoutDashboard size={18} />,
      accent: "from-[#fff5e1] to-[#fff9ee]",
      external: true,
    },
    {
      href: "/settings/usage",
      title: dict.settings.usage,
      description: dict.settings.usageDesc,
      icon: <BookOpen size={18} />,
      accent: "from-[#e7f0fb] to-[#eff4fc]",
    },
  ]

  return (
    <SettingsShell
      title={dict.settings.title}
      description={dict.settings.description}
      backHref="/"
      backLabel={dict.nav.home}
      eyebrow={en ? "Settings" : "设置"}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="group relative flex items-start gap-4 overflow-hidden rounded-[--radius-xl] border border-[--color-border] bg-[--color-bg-surface] p-5 shadow-[--shadow-profile-card] transition-all duration-200 hover:-translate-y-px hover:border-[--color-brand-border] hover:no-underline hover:shadow-[var(--shadow-md)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-brand] focus-visible:ring-offset-2"
          >
            <span
              aria-hidden
              className={`relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-gradient-to-br ${item.accent} text-[--color-text-primary] shadow-[0_8px_18px_-12px_rgba(15,23,42,0.45)]`}
            >
              {item.icon}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-[15px] font-semibold tracking-tight text-[--color-text-primary]">
                  {item.title}
                </h2>
                {item.external ? (
                  <ArrowUpRight
                    size={14}
                    className="text-[--color-text-muted] opacity-0 transition-opacity group-hover:opacity-100"
                  />
                ) : null}
              </div>
              <p className="mt-1.5 text-[13px] leading-5 text-[--color-text-secondary]">{item.description}</p>
            </div>
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[--color-brand-border] to-transparent opacity-0 transition-opacity group-hover:opacity-100"
            />
          </Link>
        ))}
      </div>
    </SettingsShell>
  )
}
