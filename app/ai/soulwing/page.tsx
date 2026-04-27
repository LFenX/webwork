import { SoulWingSettingsClient } from "@/components/ai/soulwing-settings-client"
import { requireAuth } from "@/lib/auth"

export const dynamic = "force-dynamic"
export const fetchCache = "force-no-store"

export default async function SoulWingSettingsPage() {
  await requireAuth()

  return (
    <div className="min-h-[calc(var(--app-viewport-height)-3.5rem)] md:min-h-[calc(100vh-3.5rem)]">
      <div className="mx-auto w-full max-w-[960px] px-4 py-6 md:px-5 md:pt-6 md:pb-8 sm:px-6">
        <div className="mb-6">
          <h1 className="text-xl font-bold tracking-tight text-[--color-text-primary]">
            蝶灵设置中心
          </h1>
          <p className="mt-1 text-sm text-[--color-text-muted]">
            管理 SoulWing 的人格、记忆和隐私边界。
          </p>
        </div>
        <SoulWingSettingsClient />
      </div>
    </div>
  )
}
