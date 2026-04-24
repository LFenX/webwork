import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { requireAuth } from "@/lib/auth"
import { getDictionary } from "@/lib/i18n"
import { getUserSiteSettings } from "@/lib/settings"
import { SettingsShell } from "@/components/settings/settings-shell"

export const dynamic = "force-dynamic"

export default async function SettingsPage() {
  const session = await requireAuth()
  const settings = await getUserSiteSettings(session.userId)
  const dict = getDictionary(settings.language)

  const items = [
    { href: "/settings/profile", title: dict.settings.profile, description: dict.settings.profileDesc },
    { href: "/settings/password", title: dict.settings.password, description: dict.settings.passwordDesc },
    { href: "/settings/privacy", title: dict.settings.privacy, description: dict.settings.privacyDesc },
    { href: "/settings/language", title: dict.settings.language, description: dict.settings.languageDesc },
    { href: "/settings/usage", title: dict.settings.usage, description: dict.settings.usageDesc },
  ]

  return (
    <SettingsShell title={dict.settings.title} description={dict.settings.description} backHref="/" backLabel={dict.nav.home}>
      <div className="grid gap-4 md:grid-cols-2">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-start justify-between rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface] p-5 transition-colors hover:bg-[--color-bg-hover] hover:no-underline"
          >
            <div>
              <h2 className="text-base font-semibold text-[--color-text-primary]">{item.title}</h2>
              <p className="mt-2 text-sm text-[--color-text-secondary]">{item.description}</p>
            </div>
            <ChevronRight size={18} className="mt-1 text-[--color-text-muted]" />
          </Link>
        ))}
      </div>
    </SettingsShell>
  )
}
