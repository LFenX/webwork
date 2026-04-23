import { requireAuth } from "@/lib/auth"
import { getDictionary } from "@/lib/i18n"
import { getUserSiteSettings } from "@/lib/settings"
import { SettingsShell } from "@/components/settings/settings-shell"
import { LanguageSettingsForm } from "@/components/settings/language-settings-form"

export const dynamic = "force-dynamic"

export default async function SettingsLanguagePage() {
  const session = await requireAuth()
  const settings = await getUserSiteSettings(session.userId)
  const dict = getDictionary(settings.language)

  return (
    <SettingsShell title={dict.settings.languageTitle} backLabel={dict.common.back}>
      <LanguageSettingsForm
        initialLanguage={settings.language}
        labels={{
          language: dict.settings.language,
          languageHint: dict.settings.languageHint,
          chinese: dict.settings.chinese,
          english: dict.settings.english,
          save: dict.common.save,
          saving: dict.common.saving,
          saved: dict.settings.languageSaved,
        }}
      />
    </SettingsShell>
  )
}
