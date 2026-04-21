import { notFound } from "next/navigation"
import { getPost } from "@/lib/mdx"
import { requireAuth } from "@/lib/auth"
import { PostEditorClient } from "@/components/post-editor-client"

export default async function EditNotePage({ params }: { params: Promise<{ slug: string }> }) {
  const [{ slug }, { userId }] = await Promise.all([params, requireAuth()])
  const post = await getPost("notes", decodeURIComponent(slug), userId)
  if (!post) notFound()
  return <PostEditorClient mode="edit" type="notes" typeLabel="笔记" initialData={post} />
}
