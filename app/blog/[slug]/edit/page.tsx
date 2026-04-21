import { notFound } from "next/navigation"
import { getPost } from "@/lib/mdx"
import { PostEditorClient } from "@/components/post-editor-client"

export default async function EditBlogPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const post = await getPost("blog", slug)
  if (!post) notFound()

  return (
    <PostEditorClient
      mode="edit"
      type="blog"
      typeLabel="博客"
      initialData={post}
    />
  )
}
