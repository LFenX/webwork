import { notFound } from "next/navigation"
import { getPost } from "@/lib/mdx"
import { getOptionalSession } from "@/lib/auth"
import { getCreatorProfile } from "@/lib/profile"
import { canViewModule, getAccessLevel, recordVisit, visibleTo } from "@/lib/permissions"
import { ArticleReader } from "@/components/article-reader"
import { getDictionary } from "@/lib/i18n"
import { getUserSiteSettings } from "@/lib/settings"
import { buildArticleWorkspaceNav } from "@/lib/article-workspace"
import { POST_TYPES, type PostType } from "@/lib/enums"

export default async function UserBlogPostPage({
  params,
}: {
  params: Promise<{ userId: string; slug: string }>
}) {
  const [{ userId: ownerId, slug }, session] = await Promise.all([params, getOptionalSession()])
  const [creator, settings] = await Promise.all([getCreatorProfile(ownerId), getUserSiteSettings(ownerId)])
  if (!creator) notFound()

  const level = await getAccessLevel(session?.userId ?? null, ownerId)
  const allowedTypes = (await Promise.all(
    POST_TYPES.map(async (type) => (await canViewModule(ownerId, type, level)) ? type : null)
  )).filter(Boolean) as PostType[]
  if (!allowedTypes.includes("blog")) notFound()

  const visibilities = visibleTo(level)
  const post = await getPost("blog", decodeURIComponent(slug), ownerId, visibilities)
  if (!post) notFound()

  const dict = getDictionary(settings.language)
  const workspaceNav = await buildArticleWorkspaceNav({
    userId: ownerId,
    currentType: "blog",
    currentSlug: post.slug,
    dict,
    basePathPrefix: `/u/${ownerId}`,
    visibilities,
    includeNewActions: false,
    allowedTypes,
    title: creator.displayName || creator.email,
  })

  await recordVisit({ ownerId, visitorId: session?.userId ?? null, module: "blog", path: `/u/${ownerId}/blog/${slug}`, postId: post.id })

  return (
    <ArticleReader
      post={post}
      creator={creator}
      backHref={`/u/${ownerId}/blog`}
      backLabel={dict.article.backTo(dict.nav.blog)}
      workspaceNav={workspaceNav}
    />
  )
}

