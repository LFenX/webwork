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
    <div className="min-h-[calc(100vh-3rem)] bg-[radial-gradient(circle_at_top,#f8fbff_0%,#f6f8fb_42%,#eef3f8_100%)]">
      <div className="mx-auto flex w-full max-w-[1760px] flex-col px-5 py-5 sm:px-6 xl:px-8">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-[--color-text-muted]">
              {dict.nav.ai}
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[--color-text-primary]">
              AI 助手
            </h1>
          </div>
          {normalizedUser?.permissions.manageAI ? (
            <Link
              href="/admin"
              className="rounded-full border border-black/8 bg-white/80 px-4 py-2 text-sm text-[--color-text-secondary] shadow-[0_10px_30px_rgba(15,23,42,0.04)] transition-colors hover:bg-white hover:text-[--color-text-primary] hover:no-underline"
            >
              管理 AI 授权
            </Link>
          ) : null}
        </div>

        <AIAssistantClient />
      </div>
    </div>
  )
}
