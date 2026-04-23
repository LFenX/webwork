import { requireAuth } from "@/lib/auth"
import { getDictionary } from "@/lib/i18n"
import { getUserSiteSettings } from "@/lib/settings"
import { getCreatorProfile } from "@/lib/profile"
import { SettingsShell } from "@/components/settings/settings-shell"
import { ProfileSettingsForm } from "@/components/settings/profile-settings-form"

export const dynamic = "force-dynamic"

export default async function SettingsProfilePage() {
  const session = await requireAuth()
  const [settings, profile] = await Promise.all([
    getUserSiteSettings(session.userId),
    getCreatorProfile(session.userId),
  ])
  const dict = getDictionary(settings.language)

  return (
    <SettingsShell title={dict.settings.profileTitle} backLabel={dict.common.back}>
      <ProfileSettingsForm
        initialForm={{
          displayName: profile?.displayName || "",
          avatarText: profile?.avatarText || "",
          avatarUrl: profile?.avatarUrl || "",
          avatarDataUrl: "",
          location: profile?.location || "",
          bio: profile?.bio || settings.heroTagline || "",
          email: profile?.email || session.email,
        }}
        labels={{
          displayName: dict.settings.displayName,
          avatarText: dict.settings.avatarText,
          avatarUpload: dict.settings.avatarUpload,
          location: dict.settings.location,
          bio: dict.settings.bio,
          email: dict.settings.email,
          save: dict.common.save,
          saving: dict.common.saving,
          saved: dict.settings.profileSaved,
          saveFailed: dict.settings.profileSaveFailed,
          avatarImageOnly: dict.settings.avatarImageOnly,
          avatarTooLarge: dict.settings.avatarTooLarge,
        }}
      />
    </SettingsShell>
  )
}
