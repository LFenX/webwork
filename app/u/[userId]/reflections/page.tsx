import { notFound } from "next/navigation"
import { getArticleFolders, getPosts } from "@/lib/mdx"
import { getOptionalSession } from "@/lib/auth"
import { canViewModule, getAccessLevel, recordVisit, visibleTo } from "@/lib/permissions"
import { PublicPostListPage } from "@/components/profile/public-post-list-page"
import { getFriendVisibleModules } from "@/lib/friend-module-nav"
import { resolveCreatorProfileRef } from "@/lib/profile"
import { getPublicModuleMetadata } from "@/lib/public-page-metadata"

export function generateMetadata({ params }: { params: Promise<{ userId: string }> }) {
  return params.then(({ userId }) => getPublicModuleMetadata(userId, "reflections", "心得", "公开复盘和思考列表。"))
}

export default async function UserReflectionsPage({ params, searchParams }: { params: Promise<{ userId: string }>; searchParams: Promise<{ folder?: string }> }) {
  const [{ userId: ownerRef }, { folder }, session] = await Promise.all([params, searchParams, getOptionalSession()])
  const owner = await resolveCreatorProfileRef(ownerRef)
  if (!owner) notFound()
  const ownerId = owner.id

  const level = await getAccessLevel(session?.userId ?? null, ownerId)
  const moduleVisible = await canViewModule(ownerId, "reflections", level)
  if (level === "public" && !moduleVisible) notFound()
  await recordVisit({ ownerId, visitorId: session?.userId ?? null, module: "reflections", path: `/u/${owner.publicRef}/reflections` })
  const folderFilter = folder === "uncategorized" ? null : folder || undefined
  const [posts, folders, visibleModules] = moduleVisible
    ? await Promise.all([
        getPosts("reflections", ownerId, visibleTo(level), folderFilter),
        getArticleFolders("reflections", ownerId),
        getFriendVisibleModules(ownerId, level),
      ])
    : [[], [], await getFriendVisibleModules(ownerId, level)]
  const displayName = owner.displayName || (level === "public" ? "公开用户" : owner.email)

  return (
    <PublicPostListPage
      ownerId={ownerId}
      ownerRef={owner.publicRef}
      displayName={displayName}
      current="reflections"
      modules={visibleModules}
      title="心得"
      description="复盘、思考和阶段性的观点记录。"
      countLabel={`${posts.length} 篇思考`}
      posts={posts}
      folders={folders}
      selectedFolder={folder}
      moduleVisible={moduleVisible}
    />
  )
}
