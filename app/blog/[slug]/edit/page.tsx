import { notFound } from "next/navigation"
import { getPost } from "@/lib/mdx"
import { requireAuth } from "@/lib/auth"
import { PostEditorClient } from "@/components/post-editor-client"

export default async function EditBlogPage({ params }: { params: Promise<{ slug: string }> }) {
  const [{ slug }, { userId }] = await Promise.all([params, requireAuth()])
  const post = await getPost("blog", decodeURIComponent(slug), userId)
  if (!post) notFound()
  return <PostEditorClient mode="edit" type="blog" typeLabel="博客" initialData={post} />
}
