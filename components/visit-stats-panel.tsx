import { prisma } from "@/lib/db"
import { ActivityHeatmap } from "@/components/activity-heatmap"
import { formatChinaDateTime, formatDateKey } from "@/lib/time"

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
  const [total, byModule, recent, homeVisits] = await Promise.all([
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
    prisma.visitLog.findMany({
      where: { ownerId: userId, module: "home" },
      orderBy: { createdAt: "desc" },
      take: 1000,
      select: { createdAt: true },
    }),
  ])

  const heatmapData = homeVisits.reduce<Record<string, number>>((acc, visit) => {
    const key = formatDateKey(visit.createdAt)
    acc[key] = (acc[key] ?? 0) + 1
    return acc
  }, {})

  return (
    <section className="mb-10">
      <div className="mb-4 flex items-end justify-between">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[--color-text-muted]">访问统计</h2>
          <p className="mt-2 text-3xl font-semibold">{total}</p>
          <p className="text-xs text-[--color-text-muted]">
            主页访问次数。好友在同一次访问中浏览模块，会进入明细但不重复计入主页总数。
          </p>
        </div>
      </div>

      <div className="mb-4 rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface] p-4">
        <p className="mb-3 text-xs text-[--color-text-muted]">最近 26 周主页访问热力图</p>
        <ActivityHeatmap data={heatmapData} />
      </div>

      <details className="rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface] p-4">
        <summary className="cursor-pointer text-sm font-medium text-[--color-text-primary]">
          查看模块访问和明细
        </summary>
        <div className="mt-4 grid gap-6 md:grid-cols-2">
          <div>
            <p className="mb-2 text-xs text-[--color-text-muted]">各模块浏览明细次数</p>
            <div className="space-y-2">
              {byModule.length === 0 ? (
                <p className="text-sm text-[--color-text-muted]">暂无访问记录</p>
              ) : (
                byModule.map((item) => (
                  <div key={item.module} className="flex items-center justify-between border-b border-[--color-border] py-1.5 text-sm">
                    <span>{MODULE_LABEL[item.module] ?? item.module}</span>
                    <span className="font-mono">{item._count._all}</span>
                  </div>
                ))
              )}
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs text-[--color-text-muted]">最近访问</p>
            <div className="max-h-64 space-y-2 overflow-auto">
              {recent.length === 0 ? (
                <p className="text-sm text-[--color-text-muted]">暂无明细</p>
              ) : (
                recent.map((visit) => (
                  <div key={visit.id} className="border-b border-[--color-border] pb-2 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span>{visit.visitor?.displayName || visit.visitor?.email || "匿名访客"}</span>
                      <span className="text-xs text-[--color-text-muted]">{MODULE_LABEL[visit.module] ?? visit.module}</span>
                    </div>
                    <div className="text-xs text-[--color-text-muted]">{formatChinaDateTime(visit.createdAt)}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </details>
    </section>
  )
}
