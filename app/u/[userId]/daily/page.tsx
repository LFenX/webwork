import { notFound } from "next/navigation"
import { getArticleFolders, getPosts } from "@/lib/mdx"
import { getOptionalSession } from "@/lib/auth"
import { canViewModule, getAccessLevel, recordVisit, visibleTo } from "@/lib/permissions"
import { PublicPostListPage } from "@/components/profile/public-post-list-page"
import { getFriendVisibleModules } from "@/lib/friend-module-nav"
import { resolveCreatorProfileRef } from "@/lib/profile"
import { getPublicModuleMetadata } from "@/lib/public-page-metadata"

export function generateMetadata({ params }: { params: Promise<{ userId: string }> }) {
  return params.then(({ userId }) => getPublicModuleMetadata(userId, "daily", "日常", "公开日常记录列表。"))
}

export default async function UserDailyPage({ params, searchParams }: { params: Promise<{ userId: string }>; searchParams: Promise<{ folder?: string }> }) {
  const [{ userId: ownerRef }, { folder }, session] = await Promise.all([params, searchParams, getOptionalSession()])
  const owner = await resolveCreatorProfileRef(ownerRef)
  if (!owner) notFound()
  const ownerId = owner.id

  const level = await getAccessLevel(session?.userId ?? null, ownerId)
  const moduleVisible = await canViewModule(ownerId, "daily", level)
  if (level === "public" && !moduleVisible) notFound()
  await recordVisit({ ownerId, visitorId: session?.userId ?? null, module: "daily", path: `/u/${owner.publicRef}/daily` })
  const folderFilter = folder === "uncategorized" ? null : folder || undefined
  const [posts, folders, visibleModules] = moduleVisible
    ? await Promise.all([
        getPosts("daily", ownerId, visibleTo(level), folderFilter),
        getArticleFolders("daily", ownerId),
        getFriendVisibleModules(ownerId, level),
      ])
    : [[], [], await getFriendVisibleModules(ownerId, level)]
  const displayName = owner.displayName || (level === "public" ? "公开用户" : owner.email)

  return (
    <PublicPostListPage
      ownerId={ownerId}
      ownerRef={owner.publicRef}
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
