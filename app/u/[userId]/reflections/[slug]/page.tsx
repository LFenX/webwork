import { notFound } from "next/navigation"
import { prisma } from "@/lib/db"
import { getPost } from "@/lib/mdx"
import { getOptionalSession } from "@/lib/auth"
import { getAccessLevel, visibleTo } from "@/lib/permissions"
import { MarkdownContent } from "@/components/markdown-content"
import { ArticleLayout } from "@/components/article-layout"

export default async function UserReflectionPostPage({
  params,
}: {
  params: Promise<{ userId: string; slug: string }>
}) {
  const [{ userId: ownerId, slug }, session] = await Promise.all([params, getOptionalSession()])
  const owner = await prisma.user.findUnique({
    where: { id: ownerId },
    select: { id: true, displayName: true, email: true },
  })
  if (!owner) notFound()

  const level = await getAccessLevel(session?.userId ?? null, ownerId)
  const post = await getPost("reflections", decodeURIComponent(slug), ownerId, visibleTo(level))
  if (!post) notFound()

  const displayName = owner.displayName || owner.email

  return (
    <ArticleLayout backHref={`/u/${ownerId}/reflections`} backLabel={`${displayName} 的心得`}>
      <header className="mb-10">
        <h1 className="text-3xl font-semibold mb-4 leading-tight">{post.title}</h1>
        <div className="flex items-center gap-4 text-sm text-[--color-text-muted]">
          <span className="font-mono">{post.date?.slice(0, 10)}</span>
          {post.tags && post.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {post.tags.map((tag) => (
                <span key={tag} className="px-1.5 py-0.5 bg-[--color-bg-hover] rounded text-xs">{tag}</span>
              ))}
            </div>
          )}
        </div>
      </header>
      <MarkdownContent source={post.content} />
    </ArticleLayout>
  )
}
