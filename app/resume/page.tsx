import Link from "next/link"
import { getResumeContent } from "@/lib/mdx"
import { requireAuth } from "@/lib/auth"
import { MarkdownContent } from "@/components/markdown-content"
import { PrintButton } from "@/components/print-button"
import { ModuleVisibilitySelect } from "@/components/module-visibility-select"
import { getModuleVisibility } from "@/lib/permissions"
import { Pencil } from "lucide-react"

export const metadata = { title: "简历 — My Space" }
export const dynamic = "force-dynamic"
export const fetchCache = "force-no-store"

export default async function ResumePage() {
  const { userId } = await requireAuth()
  const [resume, visibility] = await Promise.all([
    getResumeContent(userId),
    getModuleVisibility(userId, "resume"),
  ])

  return (
    <div className="max-w-[960px] mx-auto px-8 py-16">
      <div className="max-w-[760px] mx-auto">
        <div className="flex items-center justify-between mb-12 no-print">
          <h1 className="text-xl font-semibold">简历</h1>
          <div className="flex items-center gap-3">
            <ModuleVisibilitySelect module="resume" initialVisibility={visibility} />
            {resume.mode === "markdown" && <PrintButton />}
            <Link
              href="/resume/edit"
              prefetch={false}
              className="inline-flex items-center gap-1.5 text-sm text-[--color-text-muted] hover:text-[--color-text-primary] hover:no-underline transition-colors"
            >
              <Pencil size={13} /> 编辑
            </Link>
          </div>
        </div>

        <div id="resume-content">
          {resume.mode === "pdf" && resume.pdfPath ? (
            <iframe
              src={resume.pdfPath}
              className="w-full border border-[--color-border] rounded"
              style={{ height: "85vh" }}
              title="简历 PDF"
            />
          ) : resume.content ? (
            <MarkdownContent source={resume.content} />
          ) : (
            <p className="text-[--color-text-muted]">
              点击右上角「编辑」开始编写简历。
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
