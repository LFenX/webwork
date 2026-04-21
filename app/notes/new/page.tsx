import { requireAuth } from "@/lib/auth"
import { PostEditorClient } from "@/components/post-editor-client"

export const metadata = { title: "新建笔记 — My Space" }

export default async function NewNotePage() {
  await requireAuth()
  return <PostEditorClient mode="create" type="notes" typeLabel="笔记" />
}
