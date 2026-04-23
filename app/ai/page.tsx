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
    <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-[1400px] flex-col px-4 py-4 sm:px-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-[--color-text-muted]">{dict.nav.ai}</p>
          <h1 className="text-2xl font-semibold text-[--color-text-primary]">AI 助手</h1>
        </div>
        {normalizedUser?.permissions.manageAI ? (
          <Link
            href="/admin"
            className="rounded-[--radius-sm] border border-[--color-border] px-3 py-2 text-sm text-[--color-text-secondary] transition-colors hover:bg-[--color-bg-hover] hover:text-[--color-text-primary] hover:no-underline"
          >
            管理 AI 授权
          </Link>
        ) : null}
      </div>

      <AIAssistantClient />
    </div>
  )
}
