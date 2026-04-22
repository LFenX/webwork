import { notFound } from "next/navigation"
import { getPost } from "@/lib/mdx"
import { getOptionalSession } from "@/lib/auth"
import { getCreatorProfile } from "@/lib/profile"
import { canViewModule, getAccessLevel, recordVisit, visibleTo } from "@/lib/permissions"
import { ArticleReader } from "@/components/article-reader"

export default async function UserReflectionPostPage({
  params,
}: {
  params: Promise<{ userId: string; slug: string }>
}) {
  const [{ userId: ownerId, slug }, session] = await Promise.all([params, getOptionalSession()])
  const creator = await getCreatorProfile(ownerId)
  if (!creator) notFound()

  const level = await getAccessLevel(session?.userId ?? null, ownerId)
  if (!(await canViewModule(ownerId, "reflections", level))) notFound()
  const post = await getPost("reflections", decodeURIComponent(slug), ownerId, visibleTo(level))
  if (!post) notFound()
  await recordVisit({ ownerId, visitorId: session?.userId ?? null, module: "reflections", path: `/u/${ownerId}/reflections/${slug}`, postId: post.id })

  return (
    <ArticleReader
      post={post}
      creator={creator}
      backHref={`/u/${ownerId}/reflections`}
      backLabel={`返回 ${creator.displayName || creator.email} 的心得`}
    />
  )
}
