import Link from "next/link"
import { ArrowLeft, Calendar, ChevronLeft, ChevronRight, Clock, Folder, Hash, Pencil, RefreshCcw, User } from "lucide-react"
import { ArticleAside } from "@/components/article-sidebar"
import { ArticleWorkspaceShell } from "@/components/article-workspace-shell"
import { CommentsSection } from "@/components/comments-section"
import { MarkdownContent } from "@/components/markdown-content"
import { VisibilityToggle } from "@/components/visibility-toggle"
import { PostFolderSelect } from "@/components/post-folder-select"
import { getDict } from "@/lib/i18n"
import { formatChinaDateTime } from "@/lib/time"
import type { CreatorProfile } from "@/lib/profile"
import type { ArticleWorkspaceNav } from "@/lib/article-workspace"

type ArticleReaderProps = {
  post: {
    id: string
    slug: string
    title: string
    date: string
    tags: string[]
    content: string
    type: "blog" | "daily" | "reflections" | "notes"
    visibility: string
    createdAt: string
    updatedAt: string
    author: { email: string; displayName: string; id?: string }
    folder: { id: string; name: string } | null
    wordCount: number
    readingMinutes: number
  }
  creator: CreatorProfile
  backHref: string
  backLabel: string
  editHref?: string
  canEdit?: boolean
  userId?: string
  workspaceNav?: ArticleWorkspaceNav
}

export function ArticleReader({ post, creator, backHref, backLabel, editHref, canEdit = false, userId, workspaceNav }: ArticleReaderProps) {
  const dict = getDict()
  const ar = dict.article
  const aside = <ArticleAside content={post.content} profile={creator} dict={{ toc: ar.toc, noHeadings: ar.noHeadings }} mode="rail" />
  const mobileAside = <ArticleAside content={post.content} profile={creator} dict={{ toc: ar.toc, noHeadings: ar.noHeadings }} mode="stack" />

  // Find prev/next within the same module — module.posts are sorted by date desc.
  const activeModule = workspaceNav?.modules.find((m) => m.type === post.type)
  const sameModulePosts = activeModule?.posts ?? []
  const currentIndex = sameModulePosts.findIndex((p) => p.slug === post.slug)
  const newer = currentIndex > 0 ? sameModulePosts[currentIndex - 1] : null
  const older = currentIndex >= 0 && currentIndex < sameModulePosts.length - 1 ? sameModulePosts[currentIndex + 1] : null
  const moduleHref = activeModule?.href ?? backHref

  return (
    <ArticleWorkspaceShell workspaceNav={workspaceNav} rightRail={aside} mobileAfter={mobileAside}>
      <article className="notion-document">
        <div className="notion-page-bar">
          <Link href={backHref} className="notion-icon-link">
            <ArrowLeft size={14} /> {backLabel}
          </Link>
          {canEdit && editHref ? (
            <div className="flex min-w-0 items-center gap-2">
              <VisibilityToggle postId={post.id} initialVisibility={post.visibility} />
              <Link href={editHref} className="notion-toolbar-button bg-[--color-text-primary] text-white hover:bg-[--color-text-primary] hover:text-white">
                <Pencil size={14} /> {ar.edit}
              </Link>
            </div>
          ) : null}
        </div>

        <header>
          <h1 className="notion-title">{post.title}</h1>
          <div className="notion-properties">
            <div className="notion-property-row">
              <span className="notion-property-label"><Calendar size={14} /> {ar.publishedAt}</span>
              <span className="notion-property-value">{formatChinaDateTime(post.date)}</span>
            </div>
            <div className="notion-property-row">
              <span className="notion-property-label"><RefreshCcw size={14} /> {ar.updatedAt}</span>
              <span className="notion-property-value">{formatChinaDateTime(post.updatedAt)}</span>
            </div>
            <div className="notion-property-row">
              <span className="notion-property-label"><User size={14} /> {ar.author}</span>
              <span className="notion-property-value">{post.author.displayName}</span>
            </div>
            <div className="notion-property-row">
              <span className="notion-property-label"><Folder size={14} /> {ar.folder}</span>
              <span className="notion-property-value">{post.folder?.name ?? ar.uncategorized}</span>
            </div>
            {post.tags.length > 0 ? (
              <div className="notion-property-row">
                <span className="notion-property-label"><Hash size={14} /> {dict.editor.tags}</span>
                <span className="notion-property-value flex flex-wrap gap-1.5">
                  {post.tags.map((tag) => <span key={tag} className="notion-property-chip">{tag}</span>)}
                </span>
              </div>
            ) : null}
            <div className="notion-property-row">
              <span className="notion-property-label"><Clock size={14} /> {ar.readingTime}</span>
              <span className="notion-property-value">{ar.wordCount}: {post.wordCount} / {post.readingMinutes} {ar.minutes}</span>
            </div>
          </div>
        </header>

        <div className="notion-reader-content">
          <MarkdownContent source={post.content} postId={post.id} />
        </div>

        {(older || newer) ? (
          <nav className="notion-prev-next" aria-label="文章导航">
            {older ? (
              <Link href={`${moduleHref}/${encodeURIComponent(older.slug)}`} className="notion-prev-next-card notion-prev-next-prev">
                <span className="notion-prev-next-label"><ChevronLeft size={13} /> 上一篇</span>
                <span className="notion-prev-next-title">{older.title}</span>
              </Link>
            ) : <span className="notion-prev-next-spacer" />}
            {newer ? (
              <Link href={`${moduleHref}/${encodeURIComponent(newer.slug)}`} className="notion-prev-next-card notion-prev-next-next">
                <span className="notion-prev-next-label">下一篇 <ChevronRight size={13} /></span>
                <span className="notion-prev-next-title">{newer.title}</span>
              </Link>
            ) : <span className="notion-prev-next-spacer" />}
          </nav>
        ) : null}

        {canEdit ? (
          <div className="mt-12 flex items-center gap-2 border-t border-[--color-border] pt-5 text-sm text-[--color-text-muted]">
            <PostFolderSelect postId={post.id} postType={post.type} userId={userId} currentFolderId={post.folder?.id ?? null} />
          </div>
        ) : null}
      </article>

      <div className="notion-comments">
        <CommentsSection postId={post.id} />
      </div>
    </ArticleWorkspaceShell>
  )
}
