import { notFound } from "next/navigation"
import { getPost } from "@/lib/mdx"
import { PostEditorClient } from "@/components/post-editor-client"

export default async function EditNotePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const post = await getPost("notes", slug)
  if (!post) notFound()

  return <PostEditorClient mode="edit" type="notes" typeLabel="笔记" initialData={post} />
}
