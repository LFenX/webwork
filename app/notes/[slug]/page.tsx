import { notFound } from "next/navigation"
import { getPost } from "@/lib/mdx"
import { requireAuth } from "@/lib/auth"
import { getCreatorProfile } from "@/lib/profile"
import { ArticleReader } from "@/components/article-reader"

export async function generateMetadata() {
  return { title: "笔记 · My Space" }
}

export default async function NotePostPage({ params }: { params: Promise<{ slug: string }> }) {
  const [{ slug }, { userId }] = await Promise.all([params, requireAuth()])
  const [post, creator] = await Promise.all([
    getPost("notes", decodeURIComponent(slug), userId),
    getCreatorProfile(userId),
  ])
  if (!post || !creator) notFound()

  return (
    <ArticleReader
      post={post}
      creator={creator}
      backHref="/notes"
      backLabel="返回笔记"
      editHref={`/notes/${post.slug}/edit`}
      canEdit
    />
  )
}
