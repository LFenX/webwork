import Link from "next/link"
import { Globe, Sparkles, Boxes } from "lucide-react"
import { getOptionalSession } from "@/lib/auth"
import { getDictionary } from "@/lib/i18n"
import { getUserSiteSettings } from "@/lib/settings"

export const dynamic = "force-dynamic"

export default async function CommunityPage() {
  const session = await getOptionalSession()
  const settings = session ? await getUserSiteSettings(session.userId) : null
  const dict = getDictionary(settings?.language ?? "zh-CN")

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-10">
      {/* Hero */}
      <div className="mb-12 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[--color-brand-soft]">
          <Globe size={28} className="text-[--color-brand]" />
        </div>
        <h1 className="text-2xl font-semibold text-[--color-text-primary]">
          欢迎来到社区
        </h1>
        <p className="mt-2 text-sm text-[--color-text-muted] max-w-md mx-auto">
          发现、分享、贡献——这里是大家共同建设的资源空间
        </p>
      </div>

      {/* Main Entry Card */}
      <div className="mb-10">
        <Link
          href="/community/resources"
          prefetch={false}
          className="group block rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface] p-6 transition-all duration-200 hover:border-[--color-brand-border] hover:shadow-[--shadow-md] hover:-translate-y-0.5 hover:no-underline"
        >
          <div className="flex items-start gap-5">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[--color-brand-soft] transition-colors group-hover:bg-[--color-brand]">
              <Boxes size={24} className="text-[--color-brand] transition-colors group-hover:text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-semibold text-[--color-text-primary]">
                社区资源
              </h2>
              <p className="mt-1 text-sm text-[--color-text-secondary]">
                表情包社区 · 网站分享 · 更多资源
              </p>
              <p className="mt-2 text-xs text-[--color-text-muted]">
                发现大家分享的实用网站和有趣表情，共建社区资源库
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-[--color-bg-hover] px-3 py-1.5 text-xs text-[--color-text-secondary]">
                  <span className="text-base">😀</span>
                  <span>表情包社区</span>
                </div>
                <div className="inline-flex items-center gap-1.5 rounded-full bg-[--color-bg-hover] px-3 py-1.5 text-xs text-[--color-text-secondary]">
                  <Globe size={12} />
                  <span>网站分享</span>
                </div>
                <div className="inline-flex items-center gap-1.5 rounded-full bg-[--color-bg-hover] px-3 py-1.5 text-xs text-[--color-text-muted] opacity-60">
                  <Sparkles size={12} />
                  <span>更多即将到来</span>
                </div>
              </div>
            </div>
            <div className="hidden shrink-0 items-center self-center text-[--color-text-muted] transition-transform group-hover:translate-x-1 sm:flex">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M7 4L14 10L7 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </div>
        </Link>
      </div>

      {/* Future expansion area */}
      <div className="rounded-[--radius-lg] border border-dashed border-[--color-border-strong] bg-[--color-bg-soft] p-6">
        <h3 className="text-sm font-medium text-[--color-text-muted] mb-4">
          即将推出
        </h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-[--radius-md] border border-[--color-border] bg-[--color-bg-surface] p-4 opacity-60">
            <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-[--color-bg-hover]">
              <Sparkles size={14} className="text-[--color-text-muted]" />
            </div>
            <p className="text-sm font-medium text-[--color-text-primary]">代码片段分享</p>
            <p className="text-xs text-[--color-text-muted]">分享实用的代码片段和脚本</p>
          </div>
          <div className="rounded-[--radius-md] border border-[--color-border] bg-[--color-bg-surface] p-4 opacity-60">
            <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-[--color-bg-hover]">
              <Sparkles size={14} className="text-[--color-text-muted]" />
            </div>
            <p className="text-sm font-medium text-[--color-text-primary]">设计资源库</p>
            <p className="text-xs text-[--color-text-muted]">收集优质设计素材和灵感</p>
          </div>
          <div className="rounded-[--radius-md] border border-[--color-border] bg-[--color-bg-surface] p-4 opacity-60">
            <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-[--color-bg-hover]">
              <Sparkles size={14} className="text-[--color-text-muted]" />
            </div>
            <p className="text-sm font-medium text-[--color-text-primary]">更多社区功能</p>
            <p className="text-xs text-[--color-text-muted]">持续建设中，敬请期待</p>
          </div>
        </div>
      </div>
    </div>
  )
}
