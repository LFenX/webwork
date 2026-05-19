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
  return params.then(({ userId, slug }) => getPublicPostMetadata(userId, "daily", slug, "公开日常记录"))
}

export default async function UserDailyPostPage({
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
    getModuleVisibility(ownerId, "daily"),
  ])
  const allowedTypes = (await Promise.all(
    POST_TYPES.map(async (type) => (await canViewModule(ownerId, type, level)) ? type : null)
  )).filter(Boolean) as PostType[]
  if (!allowedTypes.includes("daily")) notFound()

  const visibilities = visibleTo(level)
  const post = await getPost("daily", decodeURIComponent(slug), ownerId, visibilities)
  if (!post) notFound()

  const dict = getDictionary(settings.language)
  const workspaceNav = await buildArticleWorkspaceNav({
    userId: ownerId,
    currentType: "daily",
    currentSlug: post.slug,
    dict,
    basePathPrefix: `/u/${creator.publicRef}`,
    visibilities,
    includeNewActions: false,
    allowedTypes,
    title: creator.displayName || (level === "public" ? "公开用户" : creator.email),
  })

  await recordVisit({ ownerId, visitorId: session?.userId ?? null, module: "daily", path: profileHref(creator, `daily/${slug}`), postId: post.id })
  const safePost = level === "public" ? { ...post, author: { ...post.author, email: "" } } : post

  return (
    <ArticleReader
      post={safePost}
      creator={viewerSafeProfile(creator, level)}
      backHref={profileHref(creator, "daily")}
      backLabel={dict.article.backTo(dict.nav.daily)}
      workspaceNav={workspaceNav}
      showComments={level !== "public"}
      moduleVisibility={moduleVisibility}
    />
  )
}
