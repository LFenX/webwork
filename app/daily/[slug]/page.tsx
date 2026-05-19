import { notFound } from "next/navigation"
import { getPost } from "@/lib/mdx"
import { requireAuth } from "@/lib/auth"
import { getCreatorProfile } from "@/lib/profile"
import { getDictionary } from "@/lib/i18n"
import { getUserSiteSettings } from "@/lib/settings"
import { ArticleReader } from "@/components/article-reader"
import { buildArticleWorkspaceNav } from "@/lib/article-workspace"
import { getModuleVisibility } from "@/lib/permissions"

export const dynamic = "force-dynamic"
export const fetchCache = "force-no-store"

export default async function DailyPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const [{ slug }, { userId }] = await Promise.all([params, requireAuth()])
  const [post, creator, settings, moduleVisibility] = await Promise.all([
    getPost("daily", decodeURIComponent(slug), userId),
    getCreatorProfile(userId),
    getUserSiteSettings(userId),
    getModuleVisibility(userId, "daily"),
  ])
  if (!post || !creator) notFound()

  const dict = getDictionary(settings.language)
  const workspaceNav = await buildArticleWorkspaceNav({
    userId,
    currentType: "daily",
    currentSlug: post.slug,
    dict,
    title: settings.ownerName,
  })

  return (
    <ArticleReader
      post={post}
      creator={creator}
      backHref="/daily"
      backLabel={dict.article.backTo(dict.nav.daily)}
      editHref={`/daily/${post.slug}/edit`}
      canEdit
      userId={userId}
      workspaceNav={workspaceNav}
      moduleVisibility={moduleVisibility}
    />
  )
}
