import Link from "next/link"
import { Pencil } from "lucide-react"
import { getResumeContent } from "@/lib/mdx"
import { requireAuth } from "@/lib/auth"
import { MarkdownContent } from "@/components/markdown-content"
import { ModuleVisibilitySelect } from "@/components/module-visibility-select"
import { PrintButton } from "@/components/print-button"
import { ResumePdfViewer } from "@/components/resume-pdf-viewer"
import { getModuleVisibility } from "@/lib/permissions"

export const metadata = { title: "简历 - My Space" }
export const dynamic = "force-dynamic"
export const fetchCache = "force-no-store"

export default async function ResumePage() {
  const { userId } = await requireAuth()
  const [resume, visibility] = await Promise.all([
    getResumeContent(userId),
    getModuleVisibility(userId, "resume"),
  ])

  return (
    <div className="mx-auto w-full max-w-[960px] px-4 py-12 sm:px-8 sm:py-16">
      <div className={resume.mode === "pdf" ? "mx-auto w-full" : "mx-auto max-w-[760px]"}>
        <div className="no-print mb-10 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-semibold">简历</h1>
          <div className="flex items-center gap-3">
            <ModuleVisibilitySelect module="resume" initialVisibility={visibility} />
            {resume.mode === "markdown" && <PrintButton />}
            <Link
              href="/resume/edit"
              prefetch={false}
              className="inline-flex items-center gap-1.5 text-sm text-[--color-text-muted] transition-colors hover:text-[--color-text-primary] hover:no-underline"
            >
              <Pencil size={13} /> 编辑
            </Link>
          </div>
        </div>

        <div id="resume-content">
          {resume.mode === "pdf" && resume.pdfPath ? (
            <ResumePdfViewer src={resume.pdfPath} />
          ) : resume.content ? (
            <MarkdownContent source={resume.content} />
          ) : (
            <p className="text-[--color-text-muted]">点击右上角“编辑”开始编写简历。</p>
          )}
        </div>
      </div>
    </div>
  )
}
