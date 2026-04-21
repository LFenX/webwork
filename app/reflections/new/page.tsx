import { requireAuth } from "@/lib/auth"
import { PostEditorClient } from "@/components/post-editor-client"

export const metadata = { title: "新建心得 — My Space" }

export default async function NewReflectionPage() {
  await requireAuth()
  return <PostEditorClient mode="create" type="reflections" typeLabel="心得" />
}
