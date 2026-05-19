import { FileText } from "lucide-react"
import { notFound } from "next/navigation"

import { EmptyState } from "@/components/empty-state"
import { FriendModuleNav } from "@/components/friend-module-nav"
import { MarkdownContent } from "@/components/markdown-content"
import { ModuleHero, ModulePageShell, ModulePanel } from "@/components/module/module-shell"
import { ResumeHtmlIframe } from "@/components/resume-html-iframe"
import { ResumePdfViewer } from "@/components/resume-pdf-viewer"
import { getOptionalSession } from "@/lib/auth"
import { getFriendVisibleModules } from "@/lib/friend-module-nav"
import { getResumeContent } from "@/lib/mdx"
import { canViewModule, getAccessLevel, recordVisit } from "@/lib/permissions"
import { resolveCreatorProfileRef } from "@/lib/profile"
import { getPublicModuleMetadata } from "@/lib/public-page-metadata"
import { renderResumeHtml } from "@/lib/resume/renderer"
import type { ResumeJson } from "@/lib/resume/types"

export function generateMetadata({ params }: { params: Promise<{ userId: string }> }) {
  return params.then(({ userId }) => getPublicModuleMetadata(userId, "resume", "简历", "公开简历与职业资料。"))
}

export default async function UserResumePage({ params }: { params: Promise<{ userId: string }> }) {
  const [{ userId: ownerRef }, session] = await Promise.all([params, getOptionalSession()])
  const owner = await resolveCreatorProfileRef(ownerRef)
  if (!owner) notFound()
  const ownerId = owner.id

  const level = await getAccessLevel(session?.userId ?? null, ownerId)
  const moduleVisible = await canViewModule(ownerId, "resume", level)
  if (level === "public" && !moduleVisible) notFound()
  const resume = moduleVisible
    ? await getResumeContent(ownerId)
    : { mode: "markdown", content: "", pdfPath: null, resumeJson: null, selectedTheme: null, renderedHtml: null, lastBuiltTheme: null }

  await recordVisit({ ownerId, visitorId: session?.userId ?? null, module: "resume", path: `/u/${owner.publicRef}/resume` })

  const displayName = owner.displayName || (level === "public" ? "公开用户" : owner.email)
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
      <FriendModuleNav ownerId={ownerId} ownerRef={owner.publicRef} displayName={displayName} current="resume" modules={visibleModules} />
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
