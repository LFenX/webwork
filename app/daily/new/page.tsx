import { PostEditorClient } from "@/components/post-editor-client"

export const metadata = { title: "新建日常 — My Space" }

export default function NewDailyPage() {
  return <PostEditorClient mode="create" type="daily" typeLabel="日常" />
}
