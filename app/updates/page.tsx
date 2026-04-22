import Link from "next/link"
import { ArrowLeft, GitCommitHorizontal } from "lucide-react"
import { getPublicUpdateLog } from "@/lib/update-log"
import { formatChinaDateTime } from "@/lib/time"

export const metadata = { title: "更新日志 — My Space" }
export const dynamic = "force-dynamic"

export default async function UpdatesPage() {
  const updates = await getPublicUpdateLog()

  return (
    <div className="mx-auto w-full max-w-[900px] px-6 py-10">
      <Link href="/" className="mb-8 inline-flex items-center gap-1.5 text-sm text-[--color-text-muted] hover:text-[--color-text-primary] hover:no-underline">
        <ArrowLeft size={14} /> 返回首页
      </Link>

      <header className="mb-8">
        <h1 className="text-2xl font-semibold text-[--color-text-primary]">更新日志</h1>
      </header>

      {updates.length === 0 ? (
        <p className="text-sm text-[--color-text-muted]">暂无可展示的更新记录。</p>
      ) : (
        <div className="space-y-3">
          {updates.map((item) => (
            <article key={item.hash} className="rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="flex items-start gap-2 text-sm font-medium text-[--color-text-primary]">
                    <GitCommitHorizontal size={15} className="mt-1 shrink-0" />
                    <span className="break-words">{item.message}</span>
                  </h2>
                  <p className="mt-2 font-mono text-xs text-[--color-text-muted]">{item.hash.slice(0, 12)}</p>
                </div>
                <time className="shrink-0 font-mono text-xs text-[--color-text-muted]">
                  {formatChinaDateTime(item.date)}
                </time>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
