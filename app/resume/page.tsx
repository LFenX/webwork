import Link from "next/link"
import { Pencil } from "lucide-react"
import { getResumeContent } from "@/lib/mdx"
import { requireAuth } from "@/lib/auth"
import { MarkdownContent } from "@/components/markdown-content"
import { ModuleVisibilitySelect } from "@/components/module-visibility-select"
import { PrintButton } from "@/components/print-button"
import { ResumePdfViewer } from "@/components/resume-pdf-viewer"
import { getModuleVisibility } from "@/lib/permissions"
import { getDictionary } from "@/lib/i18n"
import { getUserSiteSettings } from "@/lib/settings"

export const dynamic = "force-dynamic"
export const fetchCache = "force-no-store"

export default async function ResumePage() {
  const { userId } = await requireAuth()
  const [resume, visibility, settings] = await Promise.all([
    getResumeContent(userId),
    getModuleVisibility(userId, "resume"),
    getUserSiteSettings(userId),
  ])
  const dict = getDictionary(settings.language)
  const re = dict.resume

  return (
    <div className="mx-auto w-full max-w-[960px] px-4 py-12 sm:px-8 sm:py-16">
      <div className={resume.mode === "pdf" ? "mx-auto w-full" : "mx-auto max-w-[760px]"}>
        <div className="no-print mb-10 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-semibold">{re.title}</h1>
          <div className="flex items-center gap-3">
            <ModuleVisibilitySelect module="resume" initialVisibility={visibility} />
            {resume.mode === "markdown" && <PrintButton />}
            <Link
              href="/resume/edit"
              prefetch={false}
              className="inline-flex items-center gap-1.5 text-sm text-[--color-text-muted] transition-colors hover:text-[--color-text-primary] hover:no-underline"
            >
              <Pencil size={13} /> {re.edit}
            </Link>
          </div>
        </div>

        <div id="resume-content">
          {resume.mode === "pdf" && resume.pdfPath ? (
            <ResumePdfViewer src={resume.pdfPath} />
          ) : resume.content ? (
            <MarkdownContent source={resume.content} />
          ) : (
            <p className="text-[--color-text-muted]">{re.editHint}</p>
          )}
        </div>
      </div>
    </div>
  )
}
