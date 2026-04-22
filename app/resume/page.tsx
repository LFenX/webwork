import Link from "next/link"
import { getResumeContent } from "@/lib/mdx"
import { requireAuth } from "@/lib/auth"
import { MarkdownContent } from "@/components/markdown-content"
import { PrintButton } from "@/components/print-button"
import { ModuleVisibilitySelect } from "@/components/module-visibility-select"
import { getModuleVisibility } from "@/lib/permissions"
import { Pencil } from "lucide-react"

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
    <div className="mx-auto max-w-[1040px] px-4 py-16 sm:px-8">
      <div className={resume.mode === "pdf" ? "mx-auto max-w-[960px]" : "mx-auto max-w-[760px]"}>
        <div className="no-print mb-12 flex items-center justify-between">
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
            <iframe
              src={resume.pdfPath}
              className="min-h-[72vh] w-full rounded border border-[--color-border]"
              style={{ height: "min(86vh, 980px)" }}
              title="简历 PDF"
            />
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
