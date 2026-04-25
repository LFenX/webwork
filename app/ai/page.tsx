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
    <div className="h-[calc(var(--app-viewport-height)-3rem)] overflow-hidden bg-[linear-gradient(180deg,var(--color-bg-primary)_0%,#f7f3ec_100%)] md:h-[calc(100vh-3rem)]">
      <div className="mx-auto flex h-full w-full max-w-[1680px] flex-col px-0 py-0 md:px-5 md:py-5 sm:px-6 xl:px-8">
        <div className="mb-5 hidden items-center justify-between gap-3 rounded-[--radius-lg] border border-[--color-border] bg-[color:var(--color-bg-surface)] px-5 py-4 shadow-[0_14px_34px_rgba(34,27,20,0.05)] md:flex">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-[--color-text-muted]">
              {dict.nav.ai}
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[--color-text-primary]">
              {dict.ai.title}
            </h1>
          </div>
          {normalizedUser?.permissions.manageAI ? (
            <Link
              href="/admin"
              className="rounded-full border border-[--color-border] bg-[--color-bg-primary] px-4 py-2 text-sm text-[--color-text-secondary] transition-colors hover:border-[--color-border-strong] hover:bg-[--color-bg-hover] hover:text-[--color-text-primary] hover:no-underline"
            >
              {dict.ai.manageAuth}
            </Link>
          ) : null}
        </div>

        <div className="min-h-0 flex-1">
          <AIAssistantClient />
        </div>
      </div>
    </div>
  )
}
