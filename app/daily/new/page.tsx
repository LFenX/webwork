import { requireAuth } from "@/lib/auth"
import { getCreatorProfile } from "@/lib/profile"
import { getDictionary } from "@/lib/i18n"
import { getUserSiteSettings } from "@/lib/settings"
import { PostEditorClient } from "@/components/post-editor-client"

export const dynamic = "force-dynamic"
export const fetchCache = "force-no-store"

export default async function NewDailyPage() {
  const { userId } = await requireAuth()
  const [creator, settings] = await Promise.all([
    getCreatorProfile(userId),
    getUserSiteSettings(userId),
  ])
  const dict = getDictionary(settings.language)
  return <PostEditorClient mode="create" type="daily" typeLabel={dict.nav.daily} userId={userId} creator={creator} />
}
