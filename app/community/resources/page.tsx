import Link from "next/link"
import { ArrowLeft, Globe, SmilePlus } from "lucide-react"
import { getOptionalSession } from "@/lib/auth"
import { getDictionary } from "@/lib/i18n"
import { getUserSiteSettings } from "@/lib/settings"

export const dynamic = "force-dynamic"

export default async function CommunityResourcesPage() {
  const session = await getOptionalSession()
  const settings = session ? await getUserSiteSettings(session.userId) : null
  const dict = getDictionary(settings?.language ?? "zh-CN")

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-10">
      {/* Back + title */}
      <div className="mb-8 flex items-center gap-3">
        <Link
          href="/community"
          prefetch={false}
          className="inline-flex items-center gap-2 rounded-full border border-[--color-border] bg-[--color-bg-surface] px-3 py-2 text-sm text-[--color-text-secondary] transition-colors hover:text-[--color-text-primary] hover:no-underline"
        >
          <ArrowLeft size={16} />
          {dict.common.back}
        </Link>
        <h1 className="text-xl font-semibold text-[--color-text-primary]">
          社区资源
        </h1>
      </div>

      <p className="mb-8 text-sm text-[--color-text-muted]">
        这里汇集了大家共同贡献和分享的资源
      </p>

      {/* Resource entry cards */}
      <div className="grid gap-6 lg:grid-cols-5">
        {/* Website share — main focus, larger card */}
        <Link
          href="/community/resources/websites"
          prefetch={false}
          className="group block rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface] p-6 transition-all duration-200 hover:border-[--color-brand-border] hover:shadow-[--shadow-md] hover:-translate-y-0.5 hover:no-underline lg:col-span-3"
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[--color-brand-soft] transition-colors group-hover:bg-[--color-brand]">
            <Globe size={24} className="text-[--color-brand] transition-colors group-hover:text-white" />
          </div>
          <h2 className="mt-4 text-xl font-semibold text-[--color-text-primary]">
            网站分享
          </h2>
          <p className="mt-2 text-sm text-[--color-text-secondary]">
            发现好用的网站资源
          </p>
          <p className="mt-1 text-xs text-[--color-text-muted]">
            按文件夹和标签探索大家分享的实用网站，也可以贡献你自己的收藏
          </p>
          <div className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-[--color-brand] transition-transform group-hover:translate-x-1">
            探索网站资源
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
              <path d="M7 4L14 10L7 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </Link>

        {/* Sticker community — existing feature */}
        <Link
          href="/stickers/community"
          prefetch={false}
          className="group block rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface] p-6 transition-all duration-200 hover:border-[--color-border-strong] hover:shadow-[--shadow-sm] hover:-translate-y-0.5 hover:no-underline lg:col-span-2"
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[--color-bg-hover] transition-colors group-hover:bg-[--color-accent]">
            <SmilePlus size={24} className="text-[--color-text-secondary] transition-colors group-hover:text-white" />
          </div>
          <h2 className="mt-4 text-xl font-semibold text-[--color-text-primary]">
            表情包社区
          </h2>
          <p className="mt-2 text-sm text-[--color-text-secondary]">
            浏览大家贡献的表情
          </p>
          <p className="mt-1 text-xs text-[--color-text-muted]">
            按贡献者分组查看，批量添加到我的表情
          </p>
          <div className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-[--color-text-secondary] transition-transform group-hover:translate-x-1">
            进入表情包社区
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
              <path d="M7 4L14 10L7 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </Link>
      </div>
    </div>
  )
}
