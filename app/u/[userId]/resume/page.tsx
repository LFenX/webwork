import { FileText } from "lucide-react"
import { notFound } from "next/navigation"

import { EmptyState } from "@/components/empty-state"
import { FriendModuleNav } from "@/components/friend-module-nav"
import { MarkdownContent } from "@/components/markdown-content"
import { ModuleHero, ModulePageShell, ModulePanel } from "@/components/module/module-shell"
import { ResumeHtmlIframe } from "@/components/resume-html-iframe"
import { ResumePdfViewer } from "@/components/resume-pdf-viewer"
import { getOptionalSession } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { getFriendVisibleModules } from "@/lib/friend-module-nav"
import { getResumeContent } from "@/lib/mdx"
import { canViewModule, getAccessLevel, recordVisit } from "@/lib/permissions"
import { renderResumeHtml } from "@/lib/resume/renderer"
import type { ResumeJson } from "@/lib/resume/types"

export default async function UserResumePage({ params }: { params: Promise<{ userId: string }> }) {
  const [{ userId: ownerId }, session] = await Promise.all([params, getOptionalSession()])
  const owner = await prisma.user.findUnique({
    where: { id: ownerId },
    select: { displayName: true, email: true },
  })
  if (!owner) notFound()

  const level = await getAccessLevel(session?.userId ?? null, ownerId)
  if (level === "none") notFound()
  const moduleVisible = await canViewModule(ownerId, "resume", level)
  const resume = moduleVisible
    ? await getResumeContent(ownerId)
    : { mode: "markdown", content: "", pdfPath: null, resumeJson: null, selectedTheme: null, renderedHtml: null, lastBuiltTheme: null }

  await recordVisit({ ownerId, visitorId: session?.userId ?? null, module: "resume", path: `/u/${ownerId}/resume` })

  const displayName = owner.displayName || owner.email
  const visibleModules = await getFriendVisibleModules(ownerId, level)

  let jsonHtml: string | null = null
  if (moduleVisible && resume.mode === "json") {
    if (resume.renderedHtml) {
      jsonHtml = resume.renderedHtml
    } else if (resume.resumeJson) {
      try {
        const result = await renderResumeHtml({
          resumeJson: resume.resumeJson as ResumeJson,
          selectedTheme: resume.selectedTheme ?? null,
        })
        if (result.ok) jsonHtml = result.html
      } catch {
        jsonHtml = null
      }
    }
  }

  return (
    <ModulePageShell maxWidth="content">
      <FriendModuleNav ownerId={ownerId} displayName={displayName} current="resume" modules={visibleModules} />
      <ModuleHero
        icon={FileText}
        title="Resume"
        description="Public career profile and resume materials shared by this user."
        stats={[
          { label: "Owner", value: displayName },
          { label: "Mode", value: resume.mode === "pdf" ? "PDF" : resume.mode === "json" ? "Online" : "Markdown" },
        ]}
      />
      <ModulePanel className={resume.mode === "pdf" ? "mx-auto w-full" : "mx-auto w-full max-w-[1080px]"} contentClassName={resume.mode === "pdf" ? "p-0" : "p-6 sm:p-8"}>
        {resume.mode === "pdf" && resume.pdfPath ? (
          <ResumePdfViewer src={resume.pdfPath} />
        ) : resume.mode === "json" && jsonHtml ? (
          <ResumeHtmlIframe srcDoc={jsonHtml} viewportWidth={1000} mode="full" />
        ) : resume.mode === "json" && !jsonHtml ? (
          <EmptyState title="Resume preview unavailable" description="The online resume cannot be displayed right now." />
        ) : resume.content ? (
          <MarkdownContent source={resume.content} />
        ) : (
          <EmptyState title="No resume content" description="This user has not shared resume content yet." />
        )}
      </ModulePanel>
    </ModulePageShell>
  )
}
