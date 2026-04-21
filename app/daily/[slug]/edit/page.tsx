import { notFound } from "next/navigation"
import { getPost } from "@/lib/mdx"
import { PostEditorClient } from "@/components/post-editor-client"

export default async function EditDailyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const post = await getPost("daily", slug)
  if (!post) notFound()

  return <PostEditorClient mode="edit" type="daily" typeLabel="日常" initialData={post} />
}
