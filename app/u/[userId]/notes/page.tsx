import { notFound } from "next/navigation"
import { prisma } from "@/lib/db"
import { getArticleFolders, getPosts } from "@/lib/mdx"
import { getOptionalSession } from "@/lib/auth"
import { canViewModule, getAccessLevel, recordVisit, visibleTo } from "@/lib/permissions"
import { PublicPostListPage } from "@/components/profile/public-post-list-page"
import { getFriendVisibleModules } from "@/lib/friend-module-nav"

export default async function UserNotesPage({ params, searchParams }: { params: Promise<{ userId: string }>; searchParams: Promise<{ folder?: string }> }) {
  const [{ userId: ownerId }, { folder }, session] = await Promise.all([params, searchParams, getOptionalSession()])
  const owner = await prisma.user.findUnique({
    where: { id: ownerId },
    select: { id: true, displayName: true, email: true },
  })
  if (!owner) notFound()

  const level = await getAccessLevel(session?.userId ?? null, ownerId)
  if (level === "none") notFound()
  const moduleVisible = await canViewModule(ownerId, "notes", level)
  await recordVisit({ ownerId, visitorId: session?.userId ?? null, module: "notes", path: `/u/${ownerId}/notes` })
  const folderFilter = folder === "uncategorized" ? null : folder || undefined
  const [posts, folders, visibleModules] = moduleVisible
    ? await Promise.all([
        getPosts("notes", ownerId, visibleTo(level), folderFilter),
        getArticleFolders("notes", ownerId),
        getFriendVisibleModules(ownerId, level),
      ])
    : [[], [], await getFriendVisibleModules(ownerId, level)]
  const displayName = owner.displayName || owner.email

  return (
    <PublicPostListPage
      ownerId={ownerId}
      displayName={displayName}
      current="notes"
      modules={visibleModules}
      title="笔记"
      description="片段化知识、资料整理和工作记录。"
      countLabel={`${posts.length} 篇笔记`}
      posts={posts}
      folders={folders}
      selectedFolder={folder}
      moduleVisible={moduleVisible}
    />
  )
}
