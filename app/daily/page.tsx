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

export default async function DailyPage({ searchParams }: { searchParams: Promise<{ folder?: string }> }) {
  const [{ userId }, { folder }] = await Promise.all([requireAuth(), searchParams])
  const folderFilter = folder === "uncategorized" ? null : folder || undefined
  const [posts, visibility, folders, settings] = await Promise.all([
    getPosts("daily", userId, ["private", "friends", "public"], folderFilter),
    getModuleVisibility(userId, "daily"),
    getArticleFolders("daily", userId),
    getUserSiteSettings(userId),
  ])
  const dict = getDictionary(settings.language)
  const navLabel = dict.nav.daily

  const grouped = posts.reduce<Record<string, typeof posts>>((acc, post) => {
    const ym = post.date?.slice(0, 7) ?? "未知"
    acc[ym] = [...(acc[ym] ?? []), post]
    return acc
  }, {})

  const months = Object.keys(grouped).sort((a, b) => (a < b ? 1 : -1))

  return (
    <div className="max-w-[800px] mx-auto px-6 py-10">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold mb-1">{navLabel}</h1>
            <p className="text-sm text-[--color-text-muted]">{dict.article.count(posts.length)}</p>
          </div>
          <div className="flex items-center gap-3">
            <ModuleVisibilitySelect module="daily" initialVisibility={visibility} />
            <Link
              href="/daily/new"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-[--color-text-primary] text-white rounded-[--radius-sm] hover:no-underline hover:opacity-90 transition-opacity"
            >
              <Plus size={13} /> {dict.article.new}
            </Link>
          </div>
        </div>
      </div>

      <ArticleFolderPanel type="daily" basePath="/daily" folders={folders} selectedFolder={folder} />

      {months.length === 0 ? (
        <p className="text-sm text-[--color-text-muted]">{dict.article.empty(navLabel)}</p>
      ) : (
        <div className="space-y-8">
          {months.map((ym) => (
            <div key={ym}>
              <h2 className="font-mono text-xs text-[--color-text-muted] mb-3 uppercase tracking-wider">{ym}</h2>
              <div className="space-y-0">
                {grouped[ym].map((post) => (
                  <Link
                    key={post.slug}
                    href={`/daily/${encodeURIComponent(post.slug)}`}
                    className="block group hover:no-underline"
                  >
                    <div draggable data-post-id={post.id} className="flex cursor-grab items-start gap-4 py-3 border-b border-[--color-border] active:cursor-grabbing">
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
