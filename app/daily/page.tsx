import Link from "next/link"
import { getPosts } from "@/lib/mdx"

export const metadata = { title: "日常 — My Space" }

export default function DailyPage() {
  const posts = getPosts("daily")

  const grouped = posts.reduce<Record<string, typeof posts>>((acc, post) => {
    const ym = post.date?.slice(0, 7) ?? "未知"
    acc[ym] = [...(acc[ym] ?? []), post]
    return acc
  }, {})

  const months = Object.keys(grouped).sort((a, b) => (a < b ? 1 : -1))

  return (
    <div className="max-w-[800px] mx-auto px-6 py-10">
      <div className="mb-8">
        <h1 className="text-xl font-semibold mb-1">日常</h1>
        <p className="text-sm text-[--color-text-muted]">{posts.length} 篇记录</p>
      </div>

      {months.length === 0 ? (
        <p className="text-sm text-[--color-text-muted]">
          在 <code className="text-xs bg-[--color-bg-hover] px-1 py-0.5 rounded">content/daily/</code> 中添加 .mdx 文件。
        </p>
      ) : (
        <div className="space-y-8">
          {months.map((ym) => (
            <div key={ym}>
              <h2 className="font-mono text-xs text-[--color-text-muted] mb-3 uppercase tracking-wider">{ym}</h2>
              <div className="space-y-0">
                {grouped[ym].map((post) => (
                  <Link
                    key={post.slug}
                    href={`/daily/${post.slug}`}
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
