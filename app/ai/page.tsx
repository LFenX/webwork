import Link from "next/link"
import { AIAssistantClient } from "@/components/ai/assistant-client"
import { requireAuth } from "@/lib/auth"
import { getUserAdminInfo, normalizeUserRole } from "@/lib/admin"
import { getDictionary } from "@/lib/i18n"
import { getUserSiteSettings } from "@/lib/settings"

export const dynamic = "force-dynamic"
export const fetchCache = "force-no-store"

export default async function AIPage() {
  const session = await requireAuth()
  const settings = await getUserSiteSettings(session.userId)
  const dict = getDictionary(settings.language)
  const user = await getUserAdminInfo(session.userId)
  const normalizedUser = user ? await normalizeUserRole(user) : null

  return (
    <div className="h-[calc(var(--app-viewport-height)-3.5rem)] overflow-hidden md:h-[calc(100vh-3.5rem)]">
      <div className="mx-auto flex h-full w-full max-w-[1680px] flex-col px-0 py-0 md:px-5 md:pt-4 md:pb-5 sm:px-6 xl:px-8">
        {/* Compact page title bar */}
        <div className="relative mb-4 hidden md:flex md:items-center md:justify-center">
          <div className="flex flex-col items-center">
            <h1 className="ai-page-title text-xl font-bold tracking-tight">
              {dict.ai.title}
            </h1>
            <div className="ai-page-title-line" />
          </div>
          <div className="absolute right-0 flex items-center gap-2">
            <Link
              href="/ai/soulwing"
              className="rounded-full px-3 py-1.5 text-xs font-medium text-[--color-text-muted] transition-all duration-200 hover:bg-[--color-brand-soft] hover:text-[--color-brand] hover:no-underline"
            >
              蝶灵设置
            </Link>
            {normalizedUser?.permissions.manageAI ? (
              <Link
                href="/admin"
                className="rounded-full px-3 py-1.5 text-xs font-medium text-[--color-text-muted] transition-all duration-200 hover:bg-[--color-brand-soft] hover:text-[--color-brand] hover:no-underline"
              >
                {dict.ai.manageAuth}
              </Link>
            ) : null}
          </div>
        </div>

        <div className="min-h-0 flex-1">
          <AIAssistantClient />
        </div>
      </div>
    </div>
  )
}
