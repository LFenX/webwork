import { notFound } from "next/navigation"
import { prisma } from "@/lib/db"
import { getArticleFolders, getPosts } from "@/lib/mdx"
import { getOptionalSession } from "@/lib/auth"
import { canViewModule, getAccessLevel, recordVisit, visibleTo } from "@/lib/permissions"
import { PublicPostListPage } from "@/components/profile/public-post-list-page"
import { getFriendVisibleModules } from "@/lib/friend-module-nav"

export default async function UserDailyPage({ params, searchParams }: { params: Promise<{ userId: string }>; searchParams: Promise<{ folder?: string }> }) {
  const [{ userId: ownerId }, { folder }, session] = await Promise.all([params, searchParams, getOptionalSession()])
  const owner = await prisma.user.findUnique({
    where: { id: ownerId },
    select: { id: true, displayName: true, email: true },
  })
  if (!owner) notFound()

  const level = await getAccessLevel(session?.userId ?? null, ownerId)
  if (level === "none") notFound()
  const moduleVisible = await canViewModule(ownerId, "daily", level)
  await recordVisit({ ownerId, visitorId: session?.userId ?? null, module: "daily", path: `/u/${ownerId}/daily` })
  const folderFilter = folder === "uncategorized" ? null : folder || undefined
  const [posts, folders, visibleModules] = moduleVisible
    ? await Promise.all([
        getPosts("daily", ownerId, visibleTo(level), folderFilter),
        getArticleFolders("daily", ownerId),
        getFriendVisibleModules(ownerId, level),
      ])
    : [[], [], await getFriendVisibleModules(ownerId, level)]
  const displayName = owner.displayName || owner.email

  return (
    <PublicPostListPage
      ownerId={ownerId}
      displayName={displayName}
      current="daily"
      modules={visibleModules}
      title="日常"
      description="最近生活、想法和片段记录。"
      countLabel={`${posts.length} 篇记录`}
      posts={posts}
      folders={folders}
      selectedFolder={folder}
      moduleVisible={moduleVisible}
    />
  )
}
