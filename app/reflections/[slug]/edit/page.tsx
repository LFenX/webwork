import { notFound } from "next/navigation"
import { getPost } from "@/lib/mdx"
import { PostEditorClient } from "@/components/post-editor-client"

export default async function EditReflectionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const post = await getPost("reflections", slug)
  if (!post) notFound()

  return <PostEditorClient mode="edit" type="reflections" typeLabel="心得" initialData={post} />
}
