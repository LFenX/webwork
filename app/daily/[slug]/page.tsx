import { notFound } from "next/navigation"
import { getPost } from "@/lib/mdx"
import { requireAuth } from "@/lib/auth"
import { MarkdownContent } from "@/components/markdown-content"
import { ArticleLayout } from "@/components/article-layout"

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  return { title: `日常 — My Space` }
}

export default async function DailyPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const [{ slug }, { userId }] = await Promise.all([params, requireAuth()])
  const post = await getPost("daily", decodeURIComponent(slug), userId)
  if (!post) notFound()

  return (
    <ArticleLayout backHref="/daily" backLabel="返回日常" editHref={`/daily/${post.slug}/edit`}>
      <header className="mb-10">
        <h1 className="text-3xl font-semibold mb-4 leading-tight">{post.title}</h1>
        <span className="font-mono text-sm text-[--color-text-muted]">{post.date?.slice(0, 10)}</span>
      </header>
      <MarkdownContent source={post.content} />
    </ArticleLayout>
  )
}
