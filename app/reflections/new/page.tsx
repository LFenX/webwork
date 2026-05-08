import { requireAuth } from "@/lib/auth"
import { getCreatorProfile } from "@/lib/profile"
import { getDictionary } from "@/lib/i18n"
import { getUserSiteSettings } from "@/lib/settings"
import { PostEditorClient } from "@/components/post-editor-client"
import { buildArticleWorkspaceNav } from "@/lib/article-workspace"

export const dynamic = "force-dynamic"
export const fetchCache = "force-no-store"

export default async function NewReflectionPage() {
  const { userId } = await requireAuth()
  const [creator, settings] = await Promise.all([
    getCreatorProfile(userId),
    getUserSiteSettings(userId),
  ])
  const dict = getDictionary(settings.language)
  const workspaceNav = await buildArticleWorkspaceNav({ userId, currentType: "reflections", dict, title: settings.ownerName })
  return <PostEditorClient mode="create" type="reflections" typeLabel={dict.nav.reflections} userId={userId} creator={creator} workspaceNav={workspaceNav} />
}
