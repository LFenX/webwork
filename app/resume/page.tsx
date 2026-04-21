import Link from "next/link"
import { getResumeContent } from "@/lib/mdx"
import { MarkdownContent } from "@/components/markdown-content"
import { PrintButton } from "@/components/print-button"
import { Pencil } from "lucide-react"

export const dynamic = "force-dynamic"
export const metadata = { title: "简历 — My Space" }

export default async function ResumePage() {
  const resume = await getResumeContent()

  return (
    <div className="max-w-[800px] mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-8 no-print">
        <h1 className="text-xl font-semibold">简历</h1>
        <div className="flex items-center gap-2">
          {resume.mode === "markdown" && <PrintButton />}
          <Link
            href="/resume/edit"
            className="inline-flex items-center gap-1.5 text-sm text-[--color-text-muted] hover:text-[--color-text-primary] hover:no-underline"
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
  )
}
