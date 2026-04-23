import { requireAuth } from "@/lib/auth"
import { getCreatorProfile } from "@/lib/profile"
import { PostEditorClient } from "@/components/post-editor-client"

export const metadata = { title: "新建博客 · My Space" }

export default async function NewBlogPage() {
  const { userId } = await requireAuth()
  const creator = await getCreatorProfile(userId)
  return <PostEditorClient mode="create" type="blog" typeLabel="博客" userId={userId} creator={creator} />
}
