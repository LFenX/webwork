import { notFound } from "next/navigation"
import { getPost } from "@/lib/mdx"
import { requireAuth } from "@/lib/auth"
import { getCreatorProfile } from "@/lib/profile"
import { ArticleReader } from "@/components/article-reader"

export async function generateMetadata() {
  return { title: "博客 · My Space" }
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const [{ slug }, { userId }] = await Promise.all([params, requireAuth()])
  const [post, creator] = await Promise.all([
    getPost("blog", decodeURIComponent(slug), userId),
    getCreatorProfile(userId),
  ])
  if (!post || !creator) notFound()

  return (
    <ArticleReader
      post={post}
      creator={creator}
      backHref="/blog"
      backLabel="返回博客"
      editHref={`/blog/${post.slug}/edit`}
      canEdit
    />
  )
}
