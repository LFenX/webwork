import { notFound } from "next/navigation"
import Link from "next/link"
import { prisma } from "@/lib/db"
import { getPosts } from "@/lib/mdx"
import { getOptionalSession } from "@/lib/auth"
import { getAccessLevel, visibleTo } from "@/lib/permissions"

export default async function UserProfilePage({ params }: { params: Promise<{ userId: string }> }) {
  const [{ userId: ownerId }, session] = await Promise.all([params, getOptionalSession()])
  const owner = await prisma.user.findUnique({
    where: { id: ownerId },
    select: { id: true, displayName: true, email: true, bio: true },
  })
  if (!owner) notFound()

  const level = await getAccessLevel(session?.userId ?? null, ownerId)
  const visibilities = visibleTo(level)

  const [blogs, notes, reflections] = await Promise.all([
    getPosts("blog", ownerId, visibilities),
    getPosts("notes", ownerId, visibilities),
    getPosts("reflections", ownerId, visibilities),
  ])

  const displayName = owner.displayName || owner.email

  return (
    <div className="max-w-[800px] mx-auto px-6 py-10">
      <div className="mb-10">
        <h1 className="text-2xl font-semibold mb-1">{displayName}</h1>
        {owner.bio && <p className="text-sm text-[--color-text-muted] mt-2">{owner.bio}</p>}
        {level === "none" && (
          <p className="text-xs text-[--color-text-muted] mt-3">仅显示公开内容。</p>
        )}
        {level === "friend" && (
          <p className="text-xs text-[--color-text-muted] mt-3">好友可见内容。</p>
        )}
      </div>

      <div className="space-y-8">
        {blogs.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-[--color-text-secondary]">博客</h2>
              <Link href={`/u/${ownerId}/blog`} className="text-xs text-[--color-text-muted] hover:text-[--color-accent]">
                全部 {blogs.length} 篇 →
              </Link>
            </div>
            <div className="space-y-0">
              {blogs.slice(0, 5).map((post) => (
                <Link key={post.slug} href={`/u/${ownerId}/blog/${encodeURIComponent(post.slug)}`} className="block group hover:no-underline">
                  <div className="flex items-center gap-4 py-2.5 border-b border-[--color-border]">
                    <span className="font-mono text-xs text-[--color-text-muted] shrink-0 w-[6rem]">{post.date?.slice(0, 10)}</span>
                    <p className="text-sm text-[--color-text-primary] group-hover:text-[--color-accent] transition-colors truncate">{post.title}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {reflections.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-[--color-text-secondary]">心得</h2>
              <Link href={`/u/${ownerId}/reflections`} className="text-xs text-[--color-text-muted] hover:text-[--color-accent]">
                全部 {reflections.length} 篇 →
              </Link>
            </div>
            <div className="space-y-0">
              {reflections.slice(0, 5).map((post) => (
                <Link key={post.slug} href={`/u/${ownerId}/reflections/${encodeURIComponent(post.slug)}`} className="block group hover:no-underline">
                  <div className="flex items-center gap-4 py-2.5 border-b border-[--color-border]">
                    <span className="font-mono text-xs text-[--color-text-muted] shrink-0 w-[6rem]">{post.date?.slice(0, 10)}</span>
                    <p className="text-sm text-[--color-text-primary] group-hover:text-[--color-accent] transition-colors truncate">{post.title}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {notes.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-[--color-text-secondary]">笔记</h2>
              <Link href={`/u/${ownerId}/notes`} className="text-xs text-[--color-text-muted] hover:text-[--color-accent]">
                全部 {notes.length} 篇 →
              </Link>
            </div>
            <div className="space-y-0">
              {notes.slice(0, 5).map((post) => (
                <Link key={post.slug} href={`/u/${ownerId}/notes/${encodeURIComponent(post.slug)}`} className="block group hover:no-underline">
                  <div className="flex items-center gap-4 py-2.5 border-b border-[--color-border]">
                    <span className="font-mono text-xs text-[--color-text-muted] shrink-0 w-[6rem]">{post.date?.slice(0, 10)}</span>
                    <p className="text-sm text-[--color-text-primary] group-hover:text-[--color-accent] transition-colors truncate">{post.title}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {blogs.length === 0 && reflections.length === 0 && notes.length === 0 && (
          <p className="text-sm text-[--color-text-muted]">暂无可见内容。</p>
        )}
      </div>
    </div>
  )
}
