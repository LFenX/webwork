import { notFound } from "next/navigation"
import { getPost } from "@/lib/mdx"
import { requireAuth } from "@/lib/auth"
import { PostEditorClient } from "@/components/post-editor-client"

export default async function EditReflectionPage({ params }: { params: Promise<{ slug: string }> }) {
  const [{ slug }, { userId }] = await Promise.all([params, requireAuth()])
  const post = await getPost("reflections", decodeURIComponent(slug), userId)
  if (!post) notFound()
  return <PostEditorClient mode="edit" type="reflections" typeLabel="心得" initialData={post} />
}
