import { requireAuth } from "@/lib/auth"
import { getCreatorProfile } from "@/lib/profile"
import { PostEditorClient } from "@/components/post-editor-client"

export const metadata = { title: "新建笔记 · My Space" }

export default async function NewNotePage() {
  const { userId } = await requireAuth()
  const creator = await getCreatorProfile(userId)
  return <PostEditorClient mode="create" type="notes" typeLabel="笔记" userId={userId} creator={creator} />
}
