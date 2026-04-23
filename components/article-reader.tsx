import Link from "next/link"
import { ArrowLeft, Calendar, Clock, Folder, Hash, Pencil, RefreshCcw, User } from "lucide-react"
import { ArticleAside } from "@/components/article-sidebar"
import { CommentsSection } from "@/components/comments-section"
import { MarkdownContent } from "@/components/markdown-content"
import { VisibilityToggle } from "@/components/visibility-toggle"
import { PostFolderSelect } from "@/components/post-folder-select"
import type { CreatorProfile } from "@/lib/profile"
import { formatChinaDateTime } from "@/lib/time"

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
    author: { email: string; displayName: string }
    folder: { id: string; name: string } | null
    wordCount: number
    readingMinutes: number
  }
  creator: CreatorProfile
  backHref: string
  backLabel: string
  editHref?: string
  canEdit?: boolean
}

export function ArticleReader({ post, creator, backHref, backLabel, editHref, canEdit = false }: ArticleReaderProps) {
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
                <Pencil size={14} /> 编辑
              </Link>
            </div>
          )}
        </div>
        <header className="mb-10">
          <h1 className="mb-4 text-3xl font-semibold leading-tight text-[--color-text-primary]">{post.title}</h1>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-[--color-text-muted]">
            <span className="inline-flex items-center gap-1.5 font-mono">
              <Calendar size={14} /> 发布于 {formatChinaDateTime(post.createdAt)}
            </span>
            <span className="inline-flex items-center gap-1.5 font-mono">
              <RefreshCcw size={14} /> 更新于 {formatChinaDateTime(post.updatedAt)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <User size={14} /> 作者 {post.author.displayName || post.author.email}
            </span>
            {canEdit ? (
              <PostFolderSelect postId={post.id} type={post.type} userId={creator.id} initialFolderId={post.folder?.id ?? null} />
            ) : (
              <span className="inline-flex items-center gap-1.5">
                <Folder size={14} /> {post.folder?.name || "未分类"}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5">
              <Hash size={14} /> 总字数 {post.wordCount}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock size={14} /> 阅读时长 {post.readingMinutes} 分钟
            </span>
            {post.tags.map((tag) => (
              <span key={tag} className="rounded bg-[--color-bg-hover] px-1.5 py-0.5 text-xs">{tag}</span>
            ))}
          </div>
        </header>
        <MarkdownContent source={post.content} />
        <div className="mt-12 border-t border-[--color-border] pt-8">
          <CommentsSection postId={post.id} />
        </div>
      </article>
      <ArticleAside profile={creator} content={post.content} />
    </div>
  )
}
