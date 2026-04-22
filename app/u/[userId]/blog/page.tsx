import { notFound } from "next/navigation"
import Link from "next/link"
import { prisma } from "@/lib/db"
import { getArticleFolders, getPosts } from "@/lib/mdx"
import { getOptionalSession } from "@/lib/auth"
import { canViewModule, getAccessLevel, recordVisit, visibleTo } from "@/lib/permissions"
import { ArticleFolderPanel } from "@/components/article-folder-panel"
import { FriendModuleNav } from "@/components/friend-module-nav"
import { getFriendVisibleModules } from "@/lib/friend-module-nav"

export default async function UserBlogPage({ params, searchParams }: { params: Promise<{ userId: string }>; searchParams: Promise<{ folder?: string }> }) {
  const [{ userId: ownerId }, { folder }, session] = await Promise.all([params, searchParams, getOptionalSession()])
  const owner = await prisma.user.findUnique({
    where: { id: ownerId },
    select: { id: true, displayName: true, email: true },
  })
  if (!owner) notFound()

  const level = await getAccessLevel(session?.userId ?? null, ownerId)
  if (level === "none") notFound()
  const moduleVisible = await canViewModule(ownerId, "blog", level)
  await recordVisit({ ownerId, visitorId: session?.userId ?? null, module: "blog", path: `/u/${ownerId}/blog` })
  const folderFilter = folder === "uncategorized" ? null : folder || undefined
  const [posts, folders, visibleModules] = moduleVisible
    ? await Promise.all([
        getPosts("blog", ownerId, visibleTo(level), folderFilter),
        getArticleFolders("blog", ownerId),
        getFriendVisibleModules(ownerId, level),
      ])
    : [[], [], await getFriendVisibleModules(ownerId, level)]
  const displayName = owner.displayName || owner.email

  return (
    <div className="max-w-[800px] mx-auto px-6 py-10">
      <FriendModuleNav ownerId={ownerId} displayName={displayName} current="blog" modules={visibleModules} />
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold mb-1">博客</h1>
          <p className="text-sm text-[--color-text-muted]">{posts.length} 篇文章</p>
        </div>
      </div>
      {moduleVisible && (
        <ArticleFolderPanel type="blog" basePath={`/u/${ownerId}/blog`} folders={folders} selectedFolder={folder} readOnly />
      )}
      {posts.length === 0 ? (
        <p className="text-sm text-[--color-text-muted]">暂无可见内容。</p>
      ) : (
        <div className="space-y-0">
          {posts.map((post) => (
            <Link key={post.slug} href={`/u/${ownerId}/blog/${encodeURIComponent(post.slug)}`} className="block group hover:no-underline">
              <div className="flex items-start gap-4 py-4 border-b border-[--color-border]">
                <span className="font-mono text-xs text-[--color-text-muted] mt-0.5 shrink-0 w-[6rem] pt-0.5">{post.date?.slice(0, 10)}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-[--color-text-primary] group-hover:text-[--color-accent] transition-colors">{post.title}</p>
                  {post.summary && <p className="text-sm text-[--color-text-muted] mt-1">{post.summary}</p>}
                  {post.tags && post.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {post.tags.map((tag) => (
                        <span key={tag} className="text-xs px-1.5 py-0.5 bg-[--color-bg-hover] text-[--color-text-muted] rounded">{tag}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
