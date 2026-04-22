import { requireAuth } from "@/lib/auth"
import { getCreatorProfile } from "@/lib/profile"
import { PostEditorClient } from "@/components/post-editor-client"

export const metadata = { title: "新建心得 · My Space" }

export default async function NewReflectionPage() {
  const { userId } = await requireAuth()
  const creator = await getCreatorProfile(userId)
  return <PostEditorClient mode="create" type="reflections" typeLabel="心得" creator={creator} />
}
