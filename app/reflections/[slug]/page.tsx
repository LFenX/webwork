import { notFound } from "next/navigation"
import { getPost } from "@/lib/mdx"
import { requireAuth } from "@/lib/auth"
import { getCreatorProfile } from "@/lib/profile"
import { ArticleReader } from "@/components/article-reader"

export async function generateMetadata() {
  return { title: "心得 · My Space" }
}

export default async function ReflectionPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const [{ slug }, { userId }] = await Promise.all([params, requireAuth()])
  const [post, creator] = await Promise.all([
    getPost("reflections", decodeURIComponent(slug), userId),
    getCreatorProfile(userId),
  ])
  if (!post || !creator) notFound()

  return (
    <ArticleReader
      post={post}
      creator={creator}
      backHref="/reflections"
      backLabel="返回心得"
      editHref={`/reflections/${post.slug}/edit`}
      canEdit
    />
  )
}
