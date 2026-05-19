import { Eye } from "lucide-react"
import { requireAuth } from "@/lib/auth"
import { getDictionary } from "@/lib/i18n"
import { getUserSiteSettings } from "@/lib/settings"
import { getModuleVisibility, type ModuleKey } from "@/lib/permissions"
import { ModuleVisibilitySelect } from "@/components/module-visibility-select"
import { SettingsSection, SettingsShell } from "@/components/settings/settings-shell"

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
    <SettingsShell
      title={dict.settings.privacyTitle}
      description={dict.settings.visibilityHint}
      backLabel={dict.common.back}
      eyebrow={settings.language === "en-US" ? "Settings · Privacy" : "设置 · 隐私"}
    >
      <SettingsSection icon={<Eye size={16} />} title={dict.settings.privacy}>
        <ul className="divide-y divide-[--color-border]">
          {visibilities.map((module) => (
            <li
              key={module.key}
              className="flex flex-col gap-3 py-3.5 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
            >
              <span className="text-[14px] font-medium text-[--color-text-primary]">{module.label}</span>
              <ModuleVisibilitySelect
                module={module.key}
                initialVisibility={module.visibility}
                labels={{
                  private: dict.settings.privateVisibility,
                  friends: dict.settings.friendsVisibility,
                  public: dict.settings.publicVisibility,
                  saveFailed: dict.settings.profileSaveFailed,
                  savedPrivate: dict.settings.privateVisibility,
                  savedFriends: dict.settings.friendsVisibility,
                  savedPublic: dict.settings.publicVisibility,
                }}
              />
            </li>
          ))}
        </ul>
      </SettingsSection>
    </SettingsShell>
  )
}
