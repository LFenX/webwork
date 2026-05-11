import Link from "next/link"
import { FileText } from "lucide-react"

import { ArticleFolderPanel } from "@/components/article-folder-panel"
import { EmptyState } from "@/components/empty-state"
import { FriendModuleNav } from "@/components/friend-module-nav"
import { ModuleHero, ModulePageShell, ModulePanel } from "@/components/module/module-shell"
import type { FriendModuleNavKey } from "@/lib/friend-module-nav"
import type { ArticleFolderItem, PostMeta } from "@/lib/mdx"

type PublicPostModule = "blog" | "daily" | "reflections" | "notes"

type PublicPostListPageProps = {
  ownerId: string
  displayName: string
  current: PublicPostModule
  modules: Record<FriendModuleNavKey, boolean>
  title: string
  description: string
  countLabel: string
  posts: PostMeta[]
  folders: ArticleFolderItem[]
  selectedFolder?: string
  moduleVisible: boolean
}

export function PublicPostListPage({
  ownerId,
  displayName,
  current,
  modules,
  title,
  description,
  countLabel,
  posts,
  folders,
  selectedFolder,
  moduleVisible,
}: PublicPostListPageProps) {
  const grouped =
    current === "daily"
      ? posts.reduce<Record<string, PostMeta[]>>((acc, post) => {
          const ym = post.date?.slice(0, 7) ?? "Unknown"
          acc[ym] = [...(acc[ym] ?? []), post]
          return acc
        }, {})
      : null
  const months = grouped ? Object.keys(grouped).sort((a, b) => (a < b ? 1 : -1)) : []

  return (
    <ModulePageShell maxWidth="content">
      <FriendModuleNav ownerId={ownerId} displayName={displayName} current={current} modules={modules} />
      <ModuleHero
        icon={FileText}
        title={title}
        description={description}
        stats={[
          { label: "Owner", value: displayName },
          { label: "Visible items", value: countLabel },
        ]}
      />

      <ModulePanel
        title="Content"
        description="Public content is shown according to the owner's visibility settings."
        action={<span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-600">{countLabel}</span>}
        contentClassName="flex flex-col gap-5 p-5"
      >
        {moduleVisible ? (
          <ArticleFolderPanel type={current} basePath={`/u/${ownerId}/${current}`} folders={folders} selectedFolder={selectedFolder} readOnly />
        ) : null}

        {!moduleVisible ? (
          <EmptyState title="Module is not available" description="This section is not visible to the current visitor." icon={FileText} />
        ) : posts.length === 0 ? (
          <EmptyState title="No visible content yet" description="There is nothing available to browse in this section." icon={FileText} />
        ) : grouped ? (
          <div className="flex flex-col gap-6">
            {months.map((ym) => (
              <div key={ym} className="min-w-0">
                <h2 className="mb-3 font-mono text-xs uppercase tracking-wider text-slate-400">{ym}</h2>
                <div className="flex flex-col gap-2">
                  {grouped[ym].map((post) => (
                    <PostRow key={post.slug} post={post} href={`/u/${ownerId}/${current}/${encodeURIComponent(post.slug)}`} compactDate />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {posts.map((post) => (
              <PostRow key={post.slug} post={post} href={`/u/${ownerId}/${current}/${encodeURIComponent(post.slug)}`} />
            ))}
          </div>
        )}
      </ModulePanel>
    </ModulePageShell>
  )
}

function PostRow({ post, href, compactDate = false }: { post: PostMeta; href: string; compactDate?: boolean }) {
  return (
    <Link
      href={href}
      className="group block min-w-0 rounded-[18px] border border-slate-200 bg-white px-3 py-3 shadow-sm transition-all hover:-translate-y-px hover:border-blue-200 hover:shadow-[0_14px_32px_rgba(37,99,235,0.08)] hover:no-underline sm:px-4"
    >
      <div className="flex min-w-0 items-start gap-3 sm:gap-4">
        <span className={`${compactDate ? "w-8" : "w-[5.75rem]"} shrink-0 pt-1 font-mono text-xs text-slate-400`}>
          {compactDate ? post.date?.slice(8, 10) : post.date?.slice(0, 10)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-6 text-slate-950 transition-colors group-hover:text-blue-600 sm:text-base">
            {post.title}
          </p>
          {post.summary ? <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-500">{post.summary}</p> : null}
          {post.tags.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {post.tags.slice(0, 6).map((tag) => (
                <span key={tag} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </Link>
  )
}
