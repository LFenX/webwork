import { prisma } from "@/lib/db"
import { formatChinaDateTime } from "@/lib/time"
import { EmptyState } from "@/components/empty-state"
import { SectionCard } from "@/components/profile/section-card"
import { StatsCard } from "@/components/stats-card"

const MODULE_LABEL: Record<string, string> = {
  home: "首页",
  resume: "简历",
  blog: "博客",
  daily: "日常",
  reflections: "心得",
  notes: "笔记",
  jobs: "求职",
  interviews: "面试",
}

export async function VisitStatsPanel({ userId }: { userId: string }) {
  const [total, byModule, recent] = await Promise.all([
    prisma.visitLog.count({ where: { ownerId: userId, module: "home" } }),
    prisma.visitLog.groupBy({
      by: ["module"],
      where: { ownerId: userId },
      _count: { _all: true },
      orderBy: { _count: { module: "desc" } },
    }),
    prisma.visitLog.findMany({
      where: { ownerId: userId },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { visitor: { select: { displayName: true, email: true } } },
    }),
  ])

  return (
    <SectionCard
      title="访问统计"
      description="主页访问和各模块浏览明细。"
      contentClassName="flex flex-col gap-4"
    >
      <StatsCard
        title="主页访问"
        value={total}
        unit="次"
        sub="模块浏览进入明细，主页总数不重复计入。"
        tone="blue"
      />

      <details className="group rounded-[18px] border border-[--color-border] bg-white/64 p-4">
        <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-[--color-text-primary] marker:hidden">
          <span>模块访问和最近明细</span>
          <span className="rounded-full bg-[--color-bg-hover] px-3 py-1 text-xs font-medium text-[--color-text-muted] transition-colors group-open:bg-[--color-brand-soft] group-open:text-[--color-brand]">
            展开
          </span>
        </summary>
        <div className="mt-4 grid gap-5 lg:grid-cols-2">
          <div>
            <p className="mb-2 text-xs text-[--color-text-muted]">各模块浏览明细次数</p>
            <div className="flex flex-col gap-2">
              {byModule.length === 0 ? (
                <EmptyState title="暂无访问记录" compact />
              ) : (
                byModule.map((item) => (
                  <div key={item.module} className="flex items-center justify-between gap-3 rounded-[12px] bg-[--color-bg-hover]/70 px-3 py-2 text-sm">
                    <span>{MODULE_LABEL[item.module] ?? item.module}</span>
                    <span className="font-mono">{item._count._all}</span>
                  </div>
                ))
              )}
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs text-[--color-text-muted]">最近访问</p>
            <div className="max-h-64 overflow-auto pr-1">
              {recent.length === 0 ? (
                <EmptyState title="暂无明细" compact />
              ) : (
                <div className="flex flex-col gap-2">
                  {recent.map((visit) => (
                  <div key={visit.id} className="rounded-[12px] border border-[--color-border] bg-white/72 px-3 py-2 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="min-w-0 break-words">{visit.visitor?.displayName || visit.visitor?.email || "匿名访客"}</span>
                      <span className="shrink-0 text-xs text-[--color-text-muted]">{MODULE_LABEL[visit.module] ?? visit.module}</span>
                    </div>
                    <div className="text-xs text-[--color-text-muted]">{formatChinaDateTime(visit.createdAt)}</div>
                  </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </details>
    </SectionCard>
  )
}
