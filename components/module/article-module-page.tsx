import Link from "next/link"
import type { ElementType } from "react"
import { BookOpen, CalendarDays, FileText, FolderOpen, Hash, Lightbulb, Plus, StickyNote } from "lucide-react"
import { ArticleFolderPanel } from "@/components/article-folder-panel"
import { EmptyState } from "@/components/empty-state"
import { ModuleHero, ModuleMetaPill, ModulePageShell, ModulePanel, ModuleStatGrid, modulePillClass } from "@/components/module/module-shell"
import { StatsCard } from "@/components/stats-card"
import { ModuleVisibilitySelect } from "@/components/module-visibility-select"
import type { ArticleFolderItem, PostMeta } from "@/lib/mdx"
import { formatDateKey } from "@/lib/time"
import type { Visibility } from "@/lib/visibility"

type ArticleModule = "blog" | "daily" | "reflections" | "notes"

type ArticleModulePageProps = {
  type: ArticleModule
  title: string
  description: string
  posts: PostMeta[]
  folders: ArticleFolderItem[]
  selectedFolder?: string
  visibility?: Visibility
  newLabel: string
  emptyLabel: string
}

const moduleIcon: Record<ArticleModule, ElementType> = {
  blog: BookOpen,
  daily: CalendarDays,
  reflections: Lightbulb,
  notes: StickyNote,
}

const moduleHint: Record<ArticleModule, string> = {
  blog: "沉淀长文、专题和系统化思考",
  daily: "记录日常片段和生活流动",
  reflections: "整理复盘、心得和阶段性观察",
  notes: "保存笔记、资料和工具线索",
}

function postDateKey(date?: string) {
  return date ? formatDateKey(date) : ""
}

function formatDate(date?: string) {
  return postDateKey(date) || "未记录"
}

function formatMonth(date?: string) {
  return postDateKey(date).slice(5, 7) || "--"
}

function formatDay(date?: string) {
  return postDateKey(date).slice(8, 10) || "--"
}

function formatYearMonth(date?: string) {
  return postDateKey(date).slice(0, 7) || "未记录"
}

function uniqueTags(posts: PostMeta[]) {
  return Array.from(new Set(posts.flatMap((post) => post.tags ?? [])))
}

function ArticleCard({ post, href }: { post: PostMeta; href: string }) {
  return (
    <Link
      href={href}
      draggable
      data-post-id={post.id}
      className="group block min-w-0 rounded-[18px] border border-slate-200/80 bg-white/86 p-4 transition-all hover:-translate-y-0.5 hover:border-blue-200 hover:bg-white hover:shadow-[0_16px_36px_rgba(15,23,42,0.07)] hover:no-underline"
    >
      <div className="flex min-w-0 gap-4">
        <div className="hidden w-16 shrink-0 rounded-[16px] bg-gradient-to-br from-blue-50 to-slate-100 text-center ring-1 ring-slate-200 sm:block">
          <div className="px-2 py-3">
            <p className="font-mono text-xs text-slate-400">{formatMonth(post.date)}</p>
            <p className="mt-1 text-2xl font-bold leading-none text-slate-900 tabular-nums">
              {formatDay(post.date)}
            </p>
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span className="font-mono">{formatDate(post.date)}</span>
            {post.folder?.name && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-500">{post.folder.name}</span>}
          </div>
          <p className="text-base font-bold leading-7 text-slate-950 transition-colors group-hover:text-blue-600 sm:text-lg">
            {post.title}
          </p>
          {post.summary && <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-500">{post.summary}</p>}
          {post.tags && post.tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {post.tags.slice(0, 6).map((tag) => (
                <span key={tag} className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-600">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </Link>
  )
}

export function ArticleModulePage({
  type,
  title,
  description,
  posts,
  folders,
  selectedFolder,
  visibility,
  newLabel,
  emptyLabel,
}: ArticleModulePageProps) {
  const Icon = moduleIcon[type]
  const tags = uniqueTags(posts)
  const grouped = type === "daily"
    ? posts.reduce<Record<string, PostMeta[]>>((acc, post) => {
        const ym = formatYearMonth(post.date)
        acc[ym] = [...(acc[ym] ?? []), post]
        return acc
      }, {})
    : null
  const months = grouped ? Object.keys(grouped).sort((a, b) => (a < b ? 1 : -1)) : []
  const basePath = `/${type}`

  return (
    <ModulePageShell maxWidth="wide">
      <div className="space-y-5">
        <ModuleHero
          icon={Icon}
          title={title}
          description={description || moduleHint[type]}
          meta={
            <>
              <ModuleMetaPill>
                <FileText size={15} />
                {posts.length} 篇内容
              </ModuleMetaPill>
              <ModuleMetaPill>
                <FolderOpen size={15} />
                {folders.length + 2} 个文件夹
              </ModuleMetaPill>
              <ModuleMetaPill>
                <Hash size={15} />
                {tags.length} 个标签
              </ModuleMetaPill>
            </>
          }
          actions={
            <>
              {visibility !== undefined && <ModuleVisibilitySelect module={type} initialVisibility={visibility} />}
              <Link href={`${basePath}/new`} className={modulePillClass(true)}>
                <Plus size={16} />
                {newLabel}
              </Link>
            </>
          }
        />

        <ModuleStatGrid className="lg:grid-cols-3">
          <StatsCard title="内容总数" value={posts.length} unit="篇" sub="持续沉淀" icon={FileText} />
          <StatsCard title="文件夹" value={folders.length + 2} unit="个" sub="拖拽归档可用" icon={FolderOpen} tone="green" />
          <StatsCard title="标签" value={tags.length} unit="个" sub="辅助主题检索" icon={Hash} tone="amber" />
        </ModuleStatGrid>

        <ModulePanel title="文件夹" description="按主题组织内容，也可以把文章拖到文件夹中完成归档。" icon={FolderOpen}>
          <ArticleFolderPanel type={type} basePath={basePath} folders={folders} selectedFolder={selectedFolder} />
        </ModulePanel>

        <ModulePanel
          title={type === "daily" ? "日常时间线" : "内容列表"}
          description={posts.length > 0 ? "最新内容会优先展示，标题、摘要和标签保持清晰可读。" : undefined}
          icon={Icon}
        >
          {posts.length === 0 ? (
            <EmptyState
              icon={Icon}
              title={emptyLabel}
              description="这里会保持完整结构，开始创作后内容会自然出现在列表中。"
              action={{ label: newLabel, href: `${basePath}/new` }}
            />
          ) : grouped ? (
            <div className="space-y-6">
              {months.map((ym) => (
                <section key={ym} className="min-w-0">
                  <h2 className="mb-3 inline-flex rounded-full bg-slate-100 px-3 py-1 font-mono text-xs font-semibold text-slate-500">
                    {ym}
                  </h2>
                  <div className="grid gap-3">
                    {grouped[ym].map((post) => (
                      <ArticleCard key={post.slug} post={post} href={`${basePath}/${encodeURIComponent(post.slug)}`} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <div className="grid gap-3">
              {posts.map((post) => (
                <ArticleCard key={post.slug} post={post} href={`${basePath}/${encodeURIComponent(post.slug)}`} />
              ))}
            </div>
          )}
        </ModulePanel>
      </div>
    </ModulePageShell>
  )
}
