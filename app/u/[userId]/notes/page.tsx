import { notFound } from "next/navigation"
import { getArticleFolders, getPosts } from "@/lib/mdx"
import { getOptionalSession } from "@/lib/auth"
import { canViewModule, getAccessLevel, recordVisit, visibleTo } from "@/lib/permissions"
import { PublicPostListPage } from "@/components/profile/public-post-list-page"
import { getFriendVisibleModules } from "@/lib/friend-module-nav"
import { resolveCreatorProfileRef } from "@/lib/profile"
import { getPublicModuleMetadata } from "@/lib/public-page-metadata"

export function generateMetadata({ params }: { params: Promise<{ userId: string }> }) {
  return params.then(({ userId }) => getPublicModuleMetadata(userId, "notes", "笔记", "公开笔记和资料整理列表。"))
}

export default async function UserNotesPage({ params, searchParams }: { params: Promise<{ userId: string }>; searchParams: Promise<{ folder?: string }> }) {
  const [{ userId: ownerRef }, { folder }, session] = await Promise.all([params, searchParams, getOptionalSession()])
  const owner = await resolveCreatorProfileRef(ownerRef)
  if (!owner) notFound()
  const ownerId = owner.id

  const level = await getAccessLevel(session?.userId ?? null, ownerId)
  const moduleVisible = await canViewModule(ownerId, "notes", level)
  if (level === "public" && !moduleVisible) notFound()
  await recordVisit({ ownerId, visitorId: session?.userId ?? null, module: "notes", path: `/u/${owner.publicRef}/notes` })
  const folderFilter = folder === "uncategorized" ? null : folder || undefined
  const [posts, folders, visibleModules] = moduleVisible
    ? await Promise.all([
        getPosts("notes", ownerId, visibleTo(level), folderFilter),
        getArticleFolders("notes", ownerId),
        getFriendVisibleModules(ownerId, level),
      ])
    : [[], [], await getFriendVisibleModules(ownerId, level)]
  const displayName = owner.displayName || (level === "public" ? "公开用户" : owner.email)

  return (
    <PublicPostListPage
      ownerId={ownerId}
      ownerRef={owner.publicRef}
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
