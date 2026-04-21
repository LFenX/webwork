import { notFound } from "next/navigation"
import Link from "next/link"
import { getPost } from "@/lib/mdx"
import { MarkdownContent } from "@/components/markdown-content"
import { ArrowLeft, Pencil } from "lucide-react"

export const dynamic = "force-dynamic"

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const post = await getPost("daily", slug)
  return { title: post ? `${post.title} — My Space` : "Not Found" }
}

export default async function DailyPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const post = await getPost("daily", slug)
  if (!post) notFound()

  return (
    <div className="max-w-[800px] mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <Link
          href="/daily"
          className="inline-flex items-center gap-1 text-sm text-[--color-text-muted] hover:text-[--color-text-primary] hover:no-underline"
        >
          <ArrowLeft size={14} /> 返回日常
        </Link>
        <Link
          href={`/daily/${slug}/edit`}
          className="inline-flex items-center gap-1.5 text-sm text-[--color-text-muted] hover:text-[--color-text-primary] hover:no-underline"
        >
          <Pencil size={13} /> 编辑
        </Link>
      </div>

      <header className="mb-8 pb-6 border-b border-[--color-border]">
        <h1 className="text-2xl font-semibold mb-2">{post.title}</h1>
        <span className="font-mono text-sm text-[--color-text-muted]">{post.date?.slice(0, 10)}</span>
      </header>

      <MarkdownContent source={post.content} />
    </div>
  )
}
