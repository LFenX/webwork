import { notFound } from "next/navigation"
import { prisma } from "@/lib/db"
import { getResumeContent } from "@/lib/mdx"
import { getOptionalSession } from "@/lib/auth"
import { canViewModule, getAccessLevel, recordVisit } from "@/lib/permissions"
import { MarkdownContent } from "@/components/markdown-content"
import { ArticleLayout } from "@/components/article-layout"
import { FriendModuleLinks } from "@/components/friend-module-nav"
import { getFriendVisibleModules } from "@/lib/friend-module-nav"

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
  const resume = moduleVisible ? await getResumeContent(ownerId) : { mode: "markdown", content: "", pdfPath: null }
  await recordVisit({ ownerId, visitorId: session?.userId ?? null, module: "resume", path: `/u/${ownerId}/resume` })

  const displayName = owner.displayName || owner.email
  const visibleModules = await getFriendVisibleModules(ownerId, level)

  return (
    <ArticleLayout
      backHref={`/u/${ownerId}`}
      backLabel={`返回 ${displayName}`}
      actions={<FriendModuleLinks ownerId={ownerId} current="resume" modules={visibleModules} />}
    >
      <header className="mb-10">
        <h1 className="text-3xl font-semibold leading-tight">简历</h1>
      </header>
      {resume.mode === "pdf" && resume.pdfPath ? (
        <iframe
          src={resume.pdfPath}
          className="h-[1200px] min-h-[calc(var(--app-viewport-height)-12rem)] w-full rounded border border-[--color-border]"
          title="简历 PDF"
        />
      ) : resume.content ? (
        <MarkdownContent source={resume.content} />
      ) : (
        <p className="text-sm text-[--color-text-muted]">暂无简历内容。</p>
      )}
    </ArticleLayout>
  )
}
