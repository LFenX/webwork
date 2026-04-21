import { requireAuth } from "@/lib/auth"
import { PostEditorClient } from "@/components/post-editor-client"

export const metadata = { title: "新建博客 — My Space" }

export default async function NewBlogPage() {
  await requireAuth()
  return <PostEditorClient mode="create" type="blog" typeLabel="博客" />
}
