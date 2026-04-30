import { getResumeContent } from "@/lib/mdx"
import { requireAuth } from "@/lib/auth"
import { getAvailableResumeThemes } from "@/lib/resume/themes"
import { ResumeEditorClient } from "./resume-editor-client"

export const metadata = { title: "编辑简历 — My Space" }

export default async function ResumeEditPage() {
  const { userId } = await requireAuth()
  const [resume, themes] = await Promise.all([
    getResumeContent(userId),
    getAvailableResumeThemes(),
  ])
  return (
    <ResumeEditorClient
      userId={userId}
      initialContent={resume.content}
      initialMode={resume.mode}
      initialPdfPath={resume.pdfPath ?? null}
      initialResumeJson={resume.resumeJson ?? null}
      initialSelectedTheme={resume.selectedTheme ?? null}
      themes={themes}
    />
  )
}
