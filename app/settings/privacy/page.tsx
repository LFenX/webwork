import { requireAuth } from "@/lib/auth"
import { getDictionary } from "@/lib/i18n"
import { getUserSiteSettings } from "@/lib/settings"
import { getModuleVisibility, type ModuleKey } from "@/lib/permissions"
import { ModuleVisibilitySelect } from "@/components/module-visibility-select"
import { SettingsShell } from "@/components/settings/settings-shell"

export const dynamic = "force-dynamic"

const MODULES: Array<{ key: ModuleKey; label: { "zh-CN": string; "en-US": string } }> = [
  { key: "home", label: { "zh-CN": "首页", "en-US": "Home" } },
  { key: "resume", label: { "zh-CN": "简历", "en-US": "Resume" } },
  { key: "blog", label: { "zh-CN": "博客", "en-US": "Blog" } },
  { key: "daily", label: { "zh-CN": "日常", "en-US": "Daily" } },
  { key: "reflections", label: { "zh-CN": "心得", "en-US": "Reflections" } },
  { key: "notes", label: { "zh-CN": "笔记", "en-US": "Notes" } },
  { key: "jobs", label: { "zh-CN": "求职", "en-US": "Jobs" } },
  { key: "interviews", label: { "zh-CN": "面试", "en-US": "Interviews" } },
]

export default async function SettingsPrivacyPage() {
  const session = await requireAuth()
  const settings = await getUserSiteSettings(session.userId)
  const dict = getDictionary(settings.language)
  const visibilities = await Promise.all(
    MODULES.map(async (module) => ({
      key: module.key,
      label: module.label[settings.language],
      visibility: await getModuleVisibility(session.userId, module.key),
    }))
  )

  return (
    <SettingsShell title={dict.settings.privacyTitle} backLabel={dict.common.back}>
      <section className="rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface] p-5">
        <p className="mb-5 text-sm text-[--color-text-secondary]">{dict.settings.visibilityHint}</p>
        <div className="space-y-4">
          {visibilities.map((module) => (
            <div key={module.key} className="flex flex-col gap-3 border-b border-[--color-border] pb-4 last:border-b-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-medium text-[--color-text-primary]">{module.label}</h2>
              </div>
              <ModuleVisibilitySelect
                module={module.key}
                initialVisibility={module.visibility}
                labels={{
                  private: dict.settings.privateVisibility,
                  friends: dict.settings.friendsVisibility,
                  saveFailed: dict.settings.profileSaveFailed,
                  savedPrivate: dict.settings.privateVisibility,
                  savedFriends: dict.settings.friendsVisibility,
                }}
              />
            </div>
          ))}
        </div>
      </section>
    </SettingsShell>
  )
}
