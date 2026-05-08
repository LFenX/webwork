import { notFound } from "next/navigation"
import { getPost } from "@/lib/mdx"
import { requireAuth } from "@/lib/auth"
import { getCreatorProfile } from "@/lib/profile"
import { getDictionary } from "@/lib/i18n"
import { getUserSiteSettings } from "@/lib/settings"
import { PostEditorClient } from "@/components/post-editor-client"
import { buildArticleWorkspaceNav } from "@/lib/article-workspace"

export const dynamic = "force-dynamic"
export const fetchCache = "force-no-store"

export default async function EditNotePage({ params }: { params: Promise<{ slug: string }> }) {
  const [{ slug }, { userId }] = await Promise.all([params, requireAuth()])
  const [post, creator, settings] = await Promise.all([
    getPost("notes", decodeURIComponent(slug), userId),
    getCreatorProfile(userId),
    getUserSiteSettings(userId),
  ])
  if (!post) notFound()
  const dict = getDictionary(settings.language)
  const workspaceNav = await buildArticleWorkspaceNav({
    userId,
    currentType: "notes",
    currentSlug: post.slug,
    dict,
    title: settings.ownerName,
  })
  return <PostEditorClient mode="edit" type="notes" typeLabel={dict.nav.notes} userId={userId} initialData={post} creator={creator} workspaceNav={workspaceNav} />
}
