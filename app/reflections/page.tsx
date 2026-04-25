import Link from "next/link"
import { getArticleFolders, getPosts } from "@/lib/mdx"
import { requireAuth } from "@/lib/auth"
import { getModuleVisibility } from "@/lib/permissions"
import { ArticleFolderPanel } from "@/components/article-folder-panel"
import { ModuleVisibilitySelect } from "@/components/module-visibility-select"
import { getDictionary } from "@/lib/i18n"
import { getUserSiteSettings } from "@/lib/settings"
import { Plus } from "lucide-react"

export const dynamic = "force-dynamic"
export const fetchCache = "force-no-store"

export default async function ReflectionsPage({ searchParams }: { searchParams: Promise<{ folder?: string }> }) {
  const [{ userId }, { folder }] = await Promise.all([requireAuth(), searchParams])
  const folderFilter = folder === "uncategorized" ? null : folder || undefined
  const [posts, visibility, folders, settings] = await Promise.all([
    getPosts("reflections", userId, ["private", "friends", "public"], folderFilter),
    getModuleVisibility(userId, "reflections"),
    getArticleFolders("reflections", userId),
    getUserSiteSettings(userId),
  ])
  const dict = getDictionary(settings.language)
  const navLabel = dict.nav.reflections
  const allTags = Array.from(new Set(posts.flatMap((p) => p.tags ?? [])))

  return (
    <div className="max-w-[800px] mx-auto px-6 py-10">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold mb-1">{navLabel}</h1>
            <p className="text-sm text-[--color-text-muted]">{dict.article.count(posts.length)}</p>
          </div>
          <div className="flex items-center gap-3">
            <ModuleVisibilitySelect module="reflections" initialVisibility={visibility} />
            <Link
              href="/reflections/new"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-[--color-text-primary] text-white rounded-[--radius-sm] hover:no-underline hover:opacity-90 transition-opacity"
            >
              <Plus size={13} /> {dict.article.new}
            </Link>
          </div>
        </div>
      </div>

      <ArticleFolderPanel type="reflections" basePath="/reflections" folders={folders} selectedFolder={folder} />

      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-6">
          {allTags.map((tag) => (
            <span
              key={tag}
              className="text-xs px-2 py-0.5 bg-[--color-bg-hover] text-[--color-text-secondary] rounded border border-[--color-border]"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {posts.length === 0 ? (
        <p className="text-sm text-[--color-text-muted]">{dict.article.empty(navLabel)}</p>
      ) : (
        <div className="space-y-0">
          {posts.map((post) => (
            <Link
              key={post.slug}
              href={`/reflections/${encodeURIComponent(post.slug)}`}
              className="block group hover:no-underline"
            >
              <div draggable data-post-id={post.id} className="flex cursor-grab items-start gap-4 py-4 border-b border-[--color-border] active:cursor-grabbing">
                <span className="font-mono text-xs text-[--color-text-muted] mt-0.5 shrink-0 w-[6rem] pt-0.5">
                  {post.date?.slice(0, 10)}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-[--color-text-primary] group-hover:text-[--color-accent] transition-colors">
                    {post.title}
                  </p>
                  {post.summary && (
                    <p className="text-sm text-[--color-text-muted] mt-1">{post.summary}</p>
                  )}
                  {post.tags && post.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {post.tags.map((tag) => (
                        <span key={tag} className="text-xs px-1.5 py-0.5 bg-[--color-bg-hover] text-[--color-text-muted] rounded">
                          {tag}
                        </span>
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
