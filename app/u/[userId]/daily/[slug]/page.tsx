import { notFound } from "next/navigation"
import { prisma } from "@/lib/db"
import { getPost } from "@/lib/mdx"
import { getOptionalSession } from "@/lib/auth"
import { getAccessLevel, visibleTo } from "@/lib/permissions"
import { MarkdownContent } from "@/components/markdown-content"
import { ArticleLayout } from "@/components/article-layout"

export default async function UserDailyPostPage({
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
  const post = await getPost("daily", decodeURIComponent(slug), ownerId, visibleTo(level))
  if (!post) notFound()

  const displayName = owner.displayName || owner.email

  return (
    <ArticleLayout backHref={`/u/${ownerId}/daily`} backLabel={`${displayName} 的日常`}>
      <header className="mb-10">
        <h1 className="text-3xl font-semibold mb-4 leading-tight">{post.title}</h1>
        <span className="font-mono text-sm text-[--color-text-muted]">{post.date?.slice(0, 10)}</span>
      </header>
      <MarkdownContent source={post.content} />
    </ArticleLayout>
  )
}
