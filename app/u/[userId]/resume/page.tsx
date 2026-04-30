import { notFound } from "next/navigation"
import { prisma } from "@/lib/db"
import { getResumeContent } from "@/lib/mdx"
import { getOptionalSession } from "@/lib/auth"
import { canViewModule, getAccessLevel, recordVisit } from "@/lib/permissions"
import { MarkdownContent } from "@/components/markdown-content"
import { FriendModuleNav } from "@/components/friend-module-nav"
import { ResumePdfViewer } from "@/components/resume-pdf-viewer"
import { ResumeHtmlIframe } from "@/components/resume-html-iframe"
import { renderResumeHtml } from "@/lib/resume/renderer"
import { getFriendVisibleModules } from "@/lib/friend-module-nav"
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

  // 优先使用已构建好的 HTML 缓存，不在访客请求中重渲主题
  let jsonHtml: string | null = null
  if (moduleVisible && resume.mode === "json") {
    if (resume.renderedHtml) {
      jsonHtml = resume.renderedHtml
    } else if (resume.resumeJson) {
      // 兼容旧数据（尚无 renderedHtml），保留一次在线渲染
      try {
        const result = await renderResumeHtml({
          resumeJson: resume.resumeJson as ResumeJson,
          selectedTheme: resume.selectedTheme ?? null,
        })
        if (result.ok) jsonHtml = result.html
      } catch { /* 渲染失败不暴露错误，只显示降级文本 */ }
    }
  }

  return (
    <div className="mx-auto w-full max-w-[960px] px-4 py-12 sm:px-8 sm:py-16">
      <FriendModuleNav ownerId={ownerId} displayName={displayName} current="resume" modules={visibleModules} />
      <div className={resume.mode === "pdf" ? "mx-auto w-full" : "mx-auto max-w-[1000px]"}>
        <header className="mb-10">
          <h1 className="text-3xl font-semibold leading-tight">简历</h1>
        </header>
        {resume.mode === "pdf" && resume.pdfPath ? (
          <ResumePdfViewer src={resume.pdfPath} />
        ) : resume.mode === "json" && jsonHtml ? (
          <ResumeHtmlIframe srcDoc={jsonHtml} viewportWidth={1000} mode="full" />
        ) : resume.mode === "json" && !jsonHtml ? (
          <p className="text-sm text-[--color-text-muted]">该用户的简历暂时无法显示</p>
        ) : resume.content ? (
          <MarkdownContent source={resume.content} />
        ) : (
          <p className="text-sm text-[--color-text-muted]">暂无简历内容。</p>
        )}
      </div>
    </div>
  )
}
