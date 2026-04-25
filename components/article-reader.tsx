import Link from "next/link"
import { ArrowLeft, Calendar, Clock, Folder, Hash, Pencil, RefreshCcw, User } from "lucide-react"
import { ArticleAside } from "@/components/article-sidebar"
import { CommentsSection } from "@/components/comments-section"
import { MarkdownContent } from "@/components/markdown-content"
import { VisibilityToggle } from "@/components/visibility-toggle"
import { PostFolderSelect } from "@/components/post-folder-select"
import { getDict } from "@/lib/i18n"
import { formatChinaDateTime } from "@/lib/time"
import type { CreatorProfile } from "@/lib/profile"

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
}

export function ArticleReader({ post, creator, backHref, backLabel, editHref, canEdit = false, userId }: ArticleReaderProps) {
  const dict = getDict()
  const ar = dict.article

  return (
    <div className="mx-auto w-full max-w-[1360px] px-6 py-10 lg:pr-[330px]">
      <article className="rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface] px-6 py-8 shadow-sm md:px-10 lg:px-12">
        <div className="mb-10 flex items-center justify-between gap-4">
          <Link
            href={backHref}
            className="inline-flex items-center gap-1.5 text-sm text-[--color-text-muted] hover:text-[--color-text-primary] hover:no-underline"
          >
            <ArrowLeft size={14} /> {backLabel}
          </Link>
          {canEdit && editHref && (
            <div className="flex items-center gap-3">
              <VisibilityToggle postId={post.id} initialVisibility={post.visibility} />
              <Link
                href={editHref}
                className="inline-flex items-center gap-1.5 rounded-[--radius-sm] bg-[--color-text-primary] px-3 py-1.5 text-sm text-[--color-bg-surface] hover:no-underline"
              >
                <Pencil size={14} /> {ar.edit}
              </Link>
            </div>
          )}
        </div>
        <header className="mb-10">
          <h1 className="mb-4 text-3xl font-semibold leading-tight text-[--color-text-primary]">{post.title}</h1>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-[--color-text-muted]">
            <span className="inline-flex items-center gap-1">
              <Calendar size={14} /> {ar.publishedAt}: {formatChinaDateTime(post.date)}
            </span>
            <span className="inline-flex items-center gap-1">
              <RefreshCcw size={14} /> {ar.updatedAt}: {formatChinaDateTime(post.updatedAt)}
            </span>
            <span className="inline-flex items-center gap-1">
              <User size={14} /> {ar.author}: {post.author.displayName}
            </span>
            {post.folder && (
              <span className="inline-flex items-center gap-1">
                <Folder size={14} /> {post.folder.name}
              </span>
            )}
            {!post.folder && (
              <span className="inline-flex items-center gap-1">
                <Folder size={14} /> {ar.uncategorized}
              </span>
            )}
            {post.tags.length > 0 && (
              <span className="inline-flex items-center gap-1">
                <Hash size={14} /> {post.tags.join(", ")}
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <Clock size={14} /> {ar.wordCount}: {post.wordCount} / {ar.readingTime}: {post.readingMinutes} {ar.minutes}
            </span>
          </div>
        </header>
        <div className="prose-custom">
          <MarkdownContent source={post.content} />
        </div>
        <div className="mt-12 flex items-center gap-2">
          <PostFolderSelect postId={post.id} postType={post.type} userId={userId} currentFolderId={post.folder?.id ?? null} />
        </div>
      </article>
      <ArticleAside content={post.content} profile={creator} dict={{ toc: ar.toc, noHeadings: ar.noHeadings }} />
      <div className="mt-12">
        <CommentsSection postId={post.id} />
      </div>
    </div>
  )
}
