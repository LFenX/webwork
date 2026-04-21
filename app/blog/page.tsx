import Link from "next/link"
import { getPosts } from "@/lib/mdx"
import { Plus } from "lucide-react"

export const metadata = { title: "博客 — My Space" }

export default async function BlogPage() {
  const posts = await getPosts("blog")

  return (
    <div className="max-w-[800px] mx-auto px-6 py-10">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold mb-1">博客</h1>
          <p className="text-sm text-[--color-text-muted]">{posts.length} 篇文章</p>
        </div>
        <Link
          href="/blog/new"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-[--color-text-primary] text-white rounded-[--radius-sm] hover:no-underline hover:opacity-90 transition-opacity"
        >
          <Plus size={13} /> 新建
        </Link>
      </div>

      {posts.length === 0 ? (
        <p className="text-sm text-[--color-text-muted]">还没有博客文章，点击右上角新建。</p>
      ) : (
        <div className="space-y-0">
          {posts.map((post) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="block group hover:no-underline"
            >
              <div className="flex items-start gap-4 py-4 border-b border-[--color-border]">
                <span className="font-mono text-xs text-[--color-text-muted] mt-0.5 shrink-0 w-[6rem] pt-0.5">
                  {post.date?.slice(0, 10)}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-[--color-text-primary] group-hover:text-[--color-accent] transition-colors">
                    {post.title}
                  </p>
                  {post.summary && (
                    <p className="text-sm text-[--color-text-muted] mt-1">{post.summary}</p>
                  )}
                  {post.tags && post.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {post.tags.map((tag) => (
                        <span
                          key={tag}
                          className="text-xs px-1.5 py-0.5 bg-[--color-bg-hover] text-[--color-text-muted] rounded"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
