import { requireAuth } from "@/lib/auth"
import { getDictionary } from "@/lib/i18n"
import { getUserSiteSettings } from "@/lib/settings"
import { SettingsShell } from "@/components/settings/settings-shell"
import { PasswordSettingsPanel } from "@/components/settings/password-settings-panel"

export const dynamic = "force-dynamic"

export default async function SettingsPasswordPage() {
  const session = await requireAuth()
  const settings = await getUserSiteSettings(session.userId)
  const dict = getDictionary(settings.language)

  return (
    <SettingsShell title={dict.settings.passwordTitle} backLabel={dict.common.back}>
      <PasswordSettingsPanel
        labels={{
          passwordInput: dict.settings.passwordInput,
          passwordSubmit: dict.settings.passwordSubmit,
          passwordStatus: dict.settings.passwordStatus,
          passwordRequested: dict.settings.passwordRequested,
          passwordRequestFailed: dict.settings.passwordRequestFailed,
          passwordNoRequest: dict.settings.passwordNoRequest,
          passwordApproved: dict.settings.passwordApproved,
          passwordPending: dict.settings.passwordPending,
          passwordRejected: dict.settings.passwordRejected,
        }}
      />
    </SettingsShell>
  )
}
