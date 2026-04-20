import { getResumeContent } from "@/lib/mdx"
import { MarkdownContent } from "@/components/markdown-content"
import { PrintButton } from "@/components/print-button"

export const metadata = { title: "简历 — My Space" }

export default function ResumePage() {
  const content = getResumeContent()

  return (
    <div className="max-w-[800px] mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-8 no-print">
        <h1 className="text-xl font-semibold">简历</h1>
        <PrintButton />
      </div>
      <div id="resume-content">
        {content ? (
          <MarkdownContent source={content} />
        ) : (
          <p className="text-[--color-text-muted]">
            请在{" "}
            <code className="text-xs bg-[--color-bg-hover] px-1 py-0.5 rounded">
              content/resume.mdx
            </code>{" "}
            中编写简历内容。
          </p>
        )}
      </div>
    </div>
  )
}
