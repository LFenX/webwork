import Link from "next/link"
import { ArrowLeft, ArrowRight, Globe, SmilePlus } from "lucide-react"
import { ModuleHero, ModulePageShell, ModulePanel } from "@/components/module/module-shell"

export const dynamic = "force-dynamic"

export default async function CommunityResourcesPage() {
  return (
    <ModulePageShell maxWidth="wide">
      <div className="space-y-5">
        <ModuleHero
          icon={Globe}
          title="社区资源"
          description="把大家共同贡献和收藏的资源放到一个统一、易浏览的入口。"
          actions={
            <Link
              href="/community"
              prefetch={false}
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600 hover:no-underline"
            >
              <ArrowLeft size={16} />
              返回社区
            </Link>
          }
        />

        <div className="grid gap-4 lg:grid-cols-5">
          <Link
            href="/community/resources/websites"
            prefetch={false}
            className="group block rounded-[22px] border border-slate-200/80 bg-white p-6 shadow-[0_16px_38px_rgba(15,23,42,0.055)] transition-all hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-[0_22px_46px_rgba(15,23,42,0.075)] hover:no-underline lg:col-span-3"
          >
            <span className="flex size-14 items-center justify-center rounded-[18px] bg-blue-50 text-blue-600 ring-1 ring-blue-100">
              <Globe size={25} />
            </span>
            <h2 className="mt-5 text-2xl font-bold text-slate-950">网站分享</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              按文件夹、标签和贡献者筛选大家分享的实用网站，也可以贡献你自己的收藏。
            </p>
            <div className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-blue-600 transition-transform group-hover:translate-x-1">
              探索网站资源
              <ArrowRight size={16} />
            </div>
          </Link>

          <Link
            href="/stickers/community"
            prefetch={false}
            className="group block rounded-[22px] border border-slate-200/80 bg-white p-6 shadow-[0_16px_38px_rgba(15,23,42,0.055)] transition-all hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-[0_22px_46px_rgba(15,23,42,0.075)] hover:no-underline lg:col-span-2"
          >
            <span className="flex size-14 items-center justify-center rounded-[18px] bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100">
              <SmilePlus size={25} />
            </span>
            <h2 className="mt-5 text-2xl font-bold text-slate-950">表情社区</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              浏览大家贡献的表情，按贡献者分组查看并添加到自己的表情库。
            </p>
            <div className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-emerald-600 transition-transform group-hover:translate-x-1">
              进入表情社区
              <ArrowRight size={16} />
            </div>
          </Link>
        </div>

        <ModulePanel title="资源组织方式" description="后续新增资源类型时，也会沿用同一套入口卡片、筛选和详情面板。" icon={Globe}>
          <div className="grid gap-3 sm:grid-cols-3">
            {["统一分类", "社区贡献", "移动端可用"].map((item) => (
              <div key={item} className="rounded-[16px] border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-sm font-semibold text-slate-800">{item}</p>
                <p className="mt-1 text-xs text-slate-400">与首页风格保持一致</p>
              </div>
            ))}
          </div>
        </ModulePanel>
      </div>
    </ModulePageShell>
  )
}
