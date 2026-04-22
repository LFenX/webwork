import { requireAuth } from "@/lib/auth"
import { getCreatorProfile } from "@/lib/profile"
import { PostEditorClient } from "@/components/post-editor-client"

export const metadata = { title: "新建日常 · My Space" }

export default async function NewDailyPage() {
  const { userId } = await requireAuth()
  const creator = await getCreatorProfile(userId)
  return <PostEditorClient mode="create" type="daily" typeLabel="日常" creator={creator} />
}
