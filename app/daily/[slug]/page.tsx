import { notFound } from "next/navigation"
import { getPost } from "@/lib/mdx"
import { requireAuth } from "@/lib/auth"
import { getCreatorProfile } from "@/lib/profile"
import { ArticleReader } from "@/components/article-reader"

export async function generateMetadata() {
  return { title: "日常 · My Space" }
}

export default async function DailyPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const [{ slug }, { userId }] = await Promise.all([params, requireAuth()])
  const [post, creator] = await Promise.all([
    getPost("daily", decodeURIComponent(slug), userId),
    getCreatorProfile(userId),
  ])
  if (!post || !creator) notFound()

  return (
    <ArticleReader
      post={post}
      creator={creator}
      backHref="/daily"
      backLabel="返回日常"
      editHref={`/daily/${post.slug}/edit`}
      canEdit
    />
  )
}
