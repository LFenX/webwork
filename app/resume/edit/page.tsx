import { getResumeContent } from "@/lib/mdx"
import { ResumeEditorClient } from "./resume-editor-client"

export const metadata = { title: "编辑简历 — My Space" }

export default async function ResumeEditPage() {
  const resume = await getResumeContent()
  return (
    <ResumeEditorClient
      initialContent={resume.content}
      initialMode={resume.mode}
      initialPdfPath={resume.pdfPath ?? null}
    />
  )
}
