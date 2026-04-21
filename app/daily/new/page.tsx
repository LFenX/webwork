import { requireAuth } from "@/lib/auth"
import { PostEditorClient } from "@/components/post-editor-client"

export const metadata = { title: "新建日常 — My Space" }

export default async function NewDailyPage() {
  await requireAuth()
  return <PostEditorClient mode="create" type="daily" typeLabel="日常" />
}
