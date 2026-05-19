import { notFound } from "next/navigation"
import { getPost } from "@/lib/mdx"
import { getOptionalSession } from "@/lib/auth"
import { profileHref, resolveCreatorProfileRef, viewerSafeProfile } from "@/lib/profile"
import { canViewModule, getAccessLevel, getModuleVisibility, recordVisit, visibleTo } from "@/lib/permissions"
import { ArticleReader } from "@/components/article-reader"
import { getDictionary } from "@/lib/i18n"
import { getUserSiteSettings } from "@/lib/settings"
import { buildArticleWorkspaceNav } from "@/lib/article-workspace"
import { POST_TYPES, type PostType } from "@/lib/enums"
import { getPublicPostMetadata } from "@/lib/public-page-metadata"

export function generateMetadata({ params }: { params: Promise<{ userId: string; slug: string }> }) {
  return params.then(({ userId, slug }) => getPublicPostMetadata(userId, "blog", slug, "公开博客文章"))
}

export default async function UserBlogPostPage({
  params,
}: {
  params: Promise<{ userId: string; slug: string }>
}) {
  const [{ userId: ownerRef, slug }, session] = await Promise.all([params, getOptionalSession()])
  const creator = await resolveCreatorProfileRef(ownerRef)
  if (!creator) notFound()
  const ownerId = creator.id
  const settings = await getUserSiteSettings(ownerId)

  const [level, moduleVisibility] = await Promise.all([
    getAccessLevel(session?.userId ?? null, ownerId),
    getModuleVisibility(ownerId, "blog"),
  ])
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
    basePathPrefix: `/u/${creator.publicRef}`,
    visibilities,
    includeNewActions: false,
    allowedTypes,
    title: creator.displayName || (level === "public" ? "公开用户" : creator.email),
  })

  await recordVisit({ ownerId, visitorId: session?.userId ?? null, module: "blog", path: profileHref(creator, `blog/${slug}`), postId: post.id })
  const safePost = level === "public" ? { ...post, author: { ...post.author, email: "" } } : post

  return (
    <ArticleReader
      post={safePost}
      creator={viewerSafeProfile(creator, level)}
      backHref={profileHref(creator, "blog")}
      backLabel={dict.article.backTo(dict.nav.blog)}
      workspaceNav={workspaceNav}
      showComments={level !== "public"}
      moduleVisibility={moduleVisibility}
    />
  )
}
