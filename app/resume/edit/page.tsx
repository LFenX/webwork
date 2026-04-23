import { getResumeContent } from "@/lib/mdx"
import { requireAuth } from "@/lib/auth"
import { ResumeEditorClient } from "./resume-editor-client"

export const metadata = { title: "编辑简历 — My Space" }

export default async function ResumeEditPage() {
  const { userId } = await requireAuth()
  const resume = await getResumeContent(userId)
  return (
    <ResumeEditorClient
      userId={userId}
      initialContent={resume.content}
      initialMode={resume.mode}
      initialPdfPath={resume.pdfPath ?? null}
    />
  )
}
