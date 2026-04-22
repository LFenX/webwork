import { notFound } from "next/navigation"
import Link from "next/link"
import { prisma } from "@/lib/db"
import { getArticleFolders, getPosts } from "@/lib/mdx"
import { getOptionalSession } from "@/lib/auth"
import { canViewModule, getAccessLevel, recordVisit, visibleTo } from "@/lib/permissions"
import { ArticleFolderPanel } from "@/components/article-folder-panel"
import { FriendModuleNav } from "@/components/friend-module-nav"
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

  const grouped = posts.reduce<Record<string, typeof posts>>((acc, post) => {
    const ym = post.date?.slice(0, 7) ?? "未知"
    acc[ym] = [...(acc[ym] ?? []), post]
    return acc
  }, {})
  const months = Object.keys(grouped).sort((a, b) => (a < b ? 1 : -1))

  return (
    <div className="max-w-[800px] mx-auto px-6 py-10">
      <FriendModuleNav ownerId={ownerId} displayName={displayName} current="daily" modules={visibleModules} />
      <div className="mb-8">
        <h1 className="text-xl font-semibold mb-1">日常</h1>
        <p className="text-sm text-[--color-text-muted]">{posts.length} 篇记录</p>
      </div>
      {moduleVisible && (
        <ArticleFolderPanel type="daily" basePath={`/u/${ownerId}/daily`} folders={folders} selectedFolder={folder} readOnly />
      )}
      {months.length === 0 ? (
        <p className="text-sm text-[--color-text-muted]">暂无可见内容。</p>
      ) : (
        <div className="space-y-8">
          {months.map((ym) => (
            <div key={ym}>
              <h2 className="font-mono text-xs text-[--color-text-muted] mb-3 uppercase tracking-wider">{ym}</h2>
              <div className="space-y-0">
                {grouped[ym].map((post) => (
                  <Link
                    key={post.slug}
                    href={`/u/${ownerId}/daily/${encodeURIComponent(post.slug)}`}
                    className="block group hover:no-underline"
                  >
                    <div className="flex items-start gap-4 py-3 border-b border-[--color-border]">
                      <span className="font-mono text-xs text-[--color-text-muted] mt-0.5 shrink-0 w-6">
                        {post.date?.slice(8, 10)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[--color-text-primary] group-hover:text-[--color-accent] transition-colors">
                          {post.title}
                        </p>
                        {post.summary && (
                          <p className="text-xs text-[--color-text-muted] mt-0.5 truncate">{post.summary}</p>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
