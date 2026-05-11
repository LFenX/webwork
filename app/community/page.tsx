import Link from "next/link"
import { ArrowRight, Boxes, Globe, Sparkles, UsersRound } from "lucide-react"
import { ModuleHero, ModulePageShell, ModulePanel, ModuleStatGrid } from "@/components/module/module-shell"
import { StatsCard } from "@/components/stats-card"

export const dynamic = "force-dynamic"

export default async function CommunityPage() {
  return (
    <ModulePageShell maxWidth="wide">
      <div className="space-y-5">
        <ModuleHero
          icon={UsersRound}
          title="社区"
          description="发现、分享、贡献资源。这里会把网站收藏、表情资源和后续社区能力统一收纳。"
          actions={
            <Link
              href="/community/resources"
              prefetch={false}
              className="inline-flex min-h-11 items-center gap-2 rounded-full bg-blue-600 px-5 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(37,99,235,0.24)] transition hover:-translate-y-px hover:bg-blue-700 hover:no-underline"
            >
              进入资源中心
              <ArrowRight size={16} />
            </Link>
          }
        />

        <ModuleStatGrid className="lg:grid-cols-3">
          <StatsCard title="资源入口" value={2} unit="个" sub="网站与表情" icon={Boxes} />
          <StatsCard title="开放访问" value="Public" sub="社区资源可浏览" icon={Globe} tone="green" />
          <StatsCard title="持续扩展" value="Next" sub="更多社区能力准备中" icon={Sparkles} tone="amber" />
        </ModuleStatGrid>

        <div className="grid gap-4 lg:grid-cols-5">
          <Link
            href="/community/resources"
            prefetch={false}
            className="group block overflow-hidden rounded-[22px] border border-slate-200/80 bg-white p-5 shadow-[0_16px_38px_rgba(15,23,42,0.055)] transition-all hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-[0_22px_46px_rgba(15,23,42,0.075)] hover:no-underline lg:col-span-3"
          >
            <div className="flex min-w-0 items-start gap-4">
              <span className="flex size-14 shrink-0 items-center justify-center rounded-[18px] bg-blue-50 text-blue-600 ring-1 ring-blue-100">
                <Boxes size={25} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xl font-bold text-slate-950">社区资源</p>
                <p className="mt-2 text-sm leading-6 text-slate-500">网站分享、表情社区和更多资源入口统一收纳在这里。</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-600">网站分享</span>
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-600">表情社区</span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">更多即将到来</span>
                </div>
              </div>
              <ArrowRight size={18} className="mt-1 shrink-0 text-blue-600 transition-transform group-hover:translate-x-1" />
            </div>
          </Link>

          <ModulePanel className="lg:col-span-2" title="即将推出" description="后续社区能力会沿用同一套卡片和工作台结构。" icon={Sparkles}>
            <div className="grid gap-3">
              {["代码片段分享", "设计资源库", "更多社区功能"].map((name) => (
                <div key={name} className="rounded-[16px] border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-sm font-semibold text-slate-700">{name}</p>
                  <p className="mt-1 text-xs text-slate-400">持续建设中</p>
                </div>
              ))}
            </div>
          </ModulePanel>
        </div>
      </div>
    </ModulePageShell>
  )
}
