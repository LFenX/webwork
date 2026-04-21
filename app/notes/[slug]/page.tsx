import { notFound } from "next/navigation"
import { getPost } from "@/lib/mdx"
import { requireAuth } from "@/lib/auth"
import { MarkdownContent } from "@/components/markdown-content"
import { ArticleLayout } from "@/components/article-layout"

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  return { title: `笔记 — My Space` }
}

export default async function NotePostPage({ params }: { params: Promise<{ slug: string }> }) {
  const [{ slug }, { userId }] = await Promise.all([params, requireAuth()])
  const post = await getPost("notes", decodeURIComponent(slug), userId)
  if (!post) notFound()

  return (
    <ArticleLayout backHref="/notes" backLabel="返回笔记" editHref={`/notes/${post.slug}/edit`}>
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
