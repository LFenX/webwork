"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { ExternalLink, Eye, Pencil, Plus, Search, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { StatusBadge } from "@/components/status-badge"
import { StatsCard } from "@/components/stats-card"
import { EmptyState } from "@/components/empty-state"
import { SimpleBarChart } from "@/components/charts/bar-chart"
import { SimpleLineChart } from "@/components/charts/line-chart"
import { JOB_STATUS, JOB_CHANNELS } from "@/lib/enums"
import { apiFetch, apiPost, apiPatch, apiDelete } from "@/lib/api-client"
import { formatChinaDate } from "@/lib/time"

interface Job {
  id: string
  company: string
  position: string
  channel: string
  appliedAt: string
  status: string
  notes?: string | null
  baseLocation?: string | null
  hrContact?: string | null
  link?: string | null
  _count?: { interviews: number }
}

interface Stats {
  total: number
  replyRate: number
  interviewRate: number
  offerRate: number
  statusDist: { name: string; value: number }[]
  channelDist: { name: string; value: number }[]
  monthlyTrend: { name: string; value: number }[]
}

interface JobsPage {
  items: Job[]
  nextCursor: string | null
  hasMore: boolean
}

type JobForm = {
  company: string
  position: string
  channel: string
  appliedAt: string
  status: string
  notes: string
  baseLocation: string
  hrContact: string
  link: string
}

const STATUS_COLORS: Record<string, string> = {
  [JOB_STATUS[0] ?? ""]: "#9A9A9A",
  [JOB_STATUS[1] ?? ""]: "#B8902D",
  [JOB_STATUS[2] ?? ""]: "#0969DA",
  [JOB_STATUS[3] ?? ""]: "#A8463A",
  [JOB_STATUS[4] ?? ""]: "#3A7D5C",
  [JOB_STATUS[5] ?? ""]: "#3A7D5C",
  [JOB_STATUS[6] ?? ""]: "#D4D1C7",
}

const defaultForm: JobForm = {
  company: "",
  position: "",
  channel: JOB_CHANNELS[0] ?? "",
  appliedAt: new Date().toISOString().slice(0, 10),
  status: JOB_STATUS[0] ?? "",
  notes: "",
  baseLocation: "",
  hrContact: "",
  link: "",
}

export function JobsClient() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [search, setSearch] = useState("")
  const [filterStatus, setFilterStatus] = useState("全部")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [editingJob, setEditingJob] = useState<Job | null>(null)
  const [detailJob, setDetailJob] = useState<Job | null>(null)
  const [form, setForm] = useState<JobForm>(defaultForm)
  const [saving, setSaving] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  const loadJobs = useCallback(async (cursor: string | null, append: boolean) => {
    if (append) setLoadingMore(true)
    else setLoading(true)
    try {
      const params = new URLSearchParams({ limit: "50" })
      if (search) params.set("q", search)
      if (filterStatus !== "全部") params.set("status", filterStatus)
      if (cursor) params.set("cursor", cursor)
      params.set("_t", String(Date.now()))
      const page = await apiFetch<JobsPage>(`/api/jobs?${params.toString()}`)
      setJobs((current) => append ? [...current, ...page.items] : page.items)
      setNextCursor(page.nextCursor)
      setHasMore(page.hasMore)
    } finally {
      if (append) setLoadingMore(false)
      else setLoading(false)
    }
  }, [filterStatus, search])

  const refreshStats = useCallback(async () => {
    const statsData = await apiFetch<Stats>(`/api/jobs/stats?_t=${Date.now()}`)
    setStats(statsData)
  }, [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        await refreshStats()
        if (cancelled) return
        await loadJobs(null, false)
      } catch {
        if (!cancelled) toast.error("加载失败")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [loadJobs, refreshKey, refreshStats])

  function triggerRefresh() { setRefreshKey(k => k + 1) }

  function openCreate() {
    setEditingJob(null)
    setForm(defaultForm)
    setDialogOpen(true)
  }

  function openDetail(job: Job) {
    setDetailJob(job)
    setDetailOpen(true)
  }

  function openEdit(job: Job) {
    setDetailOpen(false)
    setEditingJob(job)
    setForm({
      company: job.company,
      position: job.position,
      channel: job.channel,
      appliedAt: new Date(job.appliedAt).toISOString().slice(0, 10),
      status: job.status,
      notes: job.notes ?? "",
      baseLocation: job.baseLocation ?? "",
      hrContact: job.hrContact ?? "",
      link: job.link ?? "",
    })
    setDialogOpen(true)
  }

  async function handleSave() {
    if (!form.company || !form.position) {
      toast.error("公司名称和职位不能为空")
      return
    }
    setSaving(true)
    try {
      const body = {
        ...form,
        appliedAt: new Date(form.appliedAt).toISOString(),
        baseLocation: form.baseLocation || null,
        hrContact: form.hrContact || null,
        link: form.link || null,
      }
      if (editingJob) await apiPatch(`/api/jobs/${editingJob.id}`, body)
      else await apiPost("/api/jobs", body)
      setDialogOpen(false)
      toast.success(editingJob ? "已更新" : "已添加")
      triggerRefresh()
    } catch {
      toast.error("操作失败，请重试")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string, closeSheet = false) {
    if (!confirm("确认删除这条记录？")) return
    await apiDelete(`/api/jobs/${id}`)
    if (closeSheet) setDetailOpen(false)
    toast.success("已删除")
    triggerRefresh()
  }

  async function handleStatusChange(id: string, status: string) {
    const previousJobs = jobs
    const previousDetail = detailJob
    setJobs((current) => current.map((job) => (job.id === id ? { ...job, status } : job)))
    setDetailJob((current) => (current?.id === id ? { ...current, status } : current))
    try {
      const updated = await apiPatch<Job>(`/api/jobs/${id}`, { status })
      setJobs((current) => {
        const next = current.map((job) => (job.id === id ? { ...job, ...updated, _count: job._count } : job))
        return filterStatus !== "全部" && status !== filterStatus ? next.filter((job) => job.id !== id) : next
      })
      setDetailJob((current) => (current?.id === id ? { ...current, ...updated, _count: current._count } : current))
      void refreshStats()
    } catch {
      setJobs(previousJobs)
      setDetailJob(previousDetail)
      toast.error("状态更新失败")
    }
  }

  const statusDist = useMemo(() => stats?.statusDist.map((d) => ({
    ...d,
    color: STATUS_COLORS[d.name] ?? "#9A9A9A",
  })) ?? [], [stats])

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-10">
      <div className="mb-8">
        <h1 className="mb-1 text-xl font-semibold">求职追踪</h1>
        <p className="text-sm text-[--color-text-muted]">记录每一次投递，追踪求职进度</p>
      </div>

      {stats && (
        <section className="mb-8">
          <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatsCard title="累计投递" value={stats.total} sub="家公司" />
            <StatsCard title="回复率" value={`${stats.replyRate}%`} sub={stats.replyRate > 50 ? "还不错" : "继续加油"} trend={stats.replyRate > 50 ? "up" : "neutral"} />
            <StatsCard title="面试转化率" value={`${stats.interviewRate}%`} sub="进入面试" />
            <StatsCard title="Offer 率" value={`${stats.offerRate}%`} trend={stats.offerRate > 0 ? "up" : "neutral"} />
          </div>

          {stats.total > 0 && (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface] p-4">
                <p className="mb-3 text-xs text-[--color-text-muted]">按状态分布</p>
                <SimpleBarChart data={statusDist} height={Math.max(120, statusDist.length * 32)} />
              </div>
              <div className="rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface] p-4">
                <p className="mb-3 text-xs text-[--color-text-muted]">按渠道分布</p>
                <SimpleBarChart data={stats.channelDist} height={Math.max(120, stats.channelDist.length * 32)} />
              </div>
              {stats.monthlyTrend.length > 1 && (
                <div className="rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface] p-4">
                  <p className="mb-3 text-xs text-[--color-text-muted]">按月投递趋势</p>
                  <SimpleLineChart data={stats.monthlyTrend} height={180} />
                </div>
              )}
            </div>
          )}
        </section>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[--color-text-muted]" />
          <Input
            placeholder="搜索任意字段，可用空格组合条件..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 border-[--color-border] pl-8 text-sm"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[--color-text-muted] hover:text-[--color-text-primary]">
              <X size={12} />
            </button>
          )}
        </div>

        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="h-8 w-32 border-[--color-border] text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="全部">全部状态</SelectItem>
            {JOB_STATUS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>

        <Button size="sm" onClick={openCreate} className="h-8 gap-1.5">
          <Plus size={14} /> 新建记录
        </Button>
      </div>

      <div className="overflow-hidden rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-surface]">
        {loading ? (
          <div className="py-16 text-center text-sm text-[--color-text-muted]">加载中...</div>
        ) : jobs.length === 0 ? (
          <EmptyState
            title="暂无投递记录"
            description="点击右上角“新建记录”开始追踪你的求职进度"
            action={{ label: "新建记录", onClick: openCreate }}
          />
        ) : (
          <div className="overflow-x-auto bg-[--color-bg-surface]">
            <div className="min-w-[1180px]">
              <table className="w-full table-fixed border-separate border-spacing-0 bg-[--color-bg-surface] text-sm">
                <thead>
                  <tr>
                    <th className="w-[150px] border-b-2 border-[--color-border-strong] bg-[--color-bg-hover] px-4 py-2.5 text-left text-xs font-medium text-[--color-text-muted]">公司</th>
                    <th className="w-[180px] border-b-2 border-[--color-border-strong] bg-[--color-bg-hover] px-4 py-2.5 text-left text-xs font-medium text-[--color-text-muted]">职位</th>
                    <th className="w-[110px] border-b-2 border-[--color-border-strong] bg-[--color-bg-hover] px-4 py-2.5 text-left text-xs font-medium text-[--color-text-muted]">渠道</th>
                    <th className="w-[100px] border-b-2 border-[--color-border-strong] bg-[--color-bg-hover] px-4 py-2.5 text-left font-mono text-xs font-medium text-[--color-text-muted]">投递日期</th>
                    <th className="w-[120px] border-b-2 border-[--color-border-strong] bg-[--color-bg-hover] px-4 py-2.5 text-left text-xs font-medium text-[--color-text-muted]">状态</th>
                    <th className="w-[90px] border-b-2 border-[--color-border-strong] bg-[--color-bg-hover] px-4 py-2.5 text-left text-xs font-medium text-[--color-text-muted]">BASE</th>
                    <th className="w-[120px] border-b-2 border-[--color-border-strong] bg-[--color-bg-hover] px-4 py-2.5 text-left text-xs font-medium text-[--color-text-muted]">联系人</th>
                    <th className="w-[70px] border-b-2 border-[--color-border-strong] bg-[--color-bg-hover] px-4 py-2.5 text-left font-mono text-xs font-medium text-[--color-text-muted]">面试</th>
                    <th className="w-[86px] border-b-2 border-[--color-border-strong] bg-[--color-bg-hover] px-4 py-2.5 text-left text-xs font-medium text-[--color-text-muted]">链接</th>
                    <th className="w-[170px] border-b-2 border-[--color-border-strong] bg-[--color-bg-hover] px-4 py-2.5 text-left text-xs font-medium text-[--color-text-muted]">备注</th>
                    <th className="w-[90px] border-b-2 border-[--color-border-strong] bg-[--color-bg-hover] px-4 py-2.5" />
                  </tr>
                </thead>
              </table>
              <div>
                <table className="w-full table-fixed border-separate border-spacing-0 bg-[--color-bg-surface] text-sm">
                  <tbody>
                    {jobs.map((job) => (
                      <tr
                        key={job.id}
                        className="group cursor-pointer transition-colors hover:bg-[--color-bg-hover]"
                        onClick={() => openDetail(job)}
                      >
                        <td className="w-[150px] truncate border-b border-[--color-border] bg-[--color-bg-surface] px-4 py-3 font-medium group-hover:bg-[--color-bg-hover]">{job.company}</td>
                        <td className="w-[180px] truncate border-b border-[--color-border] bg-[--color-bg-surface] px-4 py-3 text-[--color-text-secondary] group-hover:bg-[--color-bg-hover]">{job.position}</td>
                        <td className="w-[110px] truncate border-b border-[--color-border] bg-[--color-bg-surface] px-4 py-3 font-mono text-xs text-[--color-text-muted] group-hover:bg-[--color-bg-hover]">{job.channel}</td>
                        <td className="w-[100px] border-b border-[--color-border] bg-[--color-bg-surface] px-4 py-3 font-mono text-xs text-[--color-text-muted] group-hover:bg-[--color-bg-hover]">{formatChinaDate(job.appliedAt, { month: "2-digit", day: "2-digit" })}</td>
                        <td className="w-[120px] border-b border-[--color-border] bg-[--color-bg-surface] px-4 py-3 group-hover:bg-[--color-bg-hover]" onClick={(e) => e.stopPropagation()}>
                          <Select value={job.status} onValueChange={(v) => handleStatusChange(job.id, v)}>
                            <SelectTrigger className="h-6 w-auto gap-1 border-0 bg-transparent p-0 shadow-none focus:ring-0">
                              <StatusBadge status={job.status} type="job" />
                            </SelectTrigger>
                            <SelectContent>
                              {JOB_STATUS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="w-[90px] truncate border-b border-[--color-border] bg-[--color-bg-surface] px-4 py-3 text-xs text-[--color-text-muted] group-hover:bg-[--color-bg-hover]">{job.baseLocation || "-"}</td>
                        <td className="w-[120px] truncate border-b border-[--color-border] bg-[--color-bg-surface] px-4 py-3 text-xs text-[--color-text-muted] group-hover:bg-[--color-bg-hover]">{job.hrContact || "-"}</td>
                        <td className="w-[70px] border-b border-[--color-border] bg-[--color-bg-surface] px-4 py-3 text-center font-mono text-xs text-[--color-text-muted] group-hover:bg-[--color-bg-hover]">{job._count?.interviews ?? 0}</td>
                        <td className="w-[86px] whitespace-nowrap border-b border-[--color-border] bg-[--color-bg-surface] px-4 py-3 group-hover:bg-[--color-bg-hover]" onClick={(e) => e.stopPropagation()}>
                          {job.link ? (
                            <a href={job.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 whitespace-nowrap text-xs text-[--color-link] hover:underline">
                              投递 <ExternalLink size={10} />
                            </a>
                          ) : <span className="text-xs text-[--color-text-muted]">-</span>}
                        </td>
                        <td className="w-[170px] truncate border-b border-[--color-border] bg-[--color-bg-surface] px-4 py-3 text-xs text-[--color-text-muted] group-hover:bg-[--color-bg-hover]">{job.notes}</td>
                        <td className="w-[90px] border-b border-[--color-border] bg-[--color-bg-surface] px-4 py-3 group-hover:bg-[--color-bg-hover]" onClick={(e) => e.stopPropagation()}>
                          <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                            <button onClick={() => openDetail(job)} className="p-1 text-[--color-text-muted] hover:text-[--color-link]" title="查看"><Eye size={13} /></button>
                            <button onClick={() => openEdit(job)} className="p-1 text-[--color-text-muted] hover:text-[--color-text-primary]" title="编辑"><Pencil size={13} /></button>
                            <button onClick={() => handleDelete(job.id)} className="p-1 text-[--color-text-muted] hover:text-[--color-danger]" title="删除"><Trash2 size={13} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {loadingMore && <p className="p-3 text-center text-xs text-[--color-text-muted]">加载更多记录...</p>}
                {hasMore && !loadingMore && (
                  <div className="border-t border-[--color-border] p-3 text-center">
                    <Button type="button" variant="outline" size="sm" onClick={() => void loadJobs(nextCursor, true)}>
                      加载更多
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {jobs.length > 0 && <p className="mt-2 font-mono text-xs text-[--color-text-muted]">{jobs.length}{hasMore ? "+" : ""} 条记录</p>}

      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          {detailJob && (
            <>
              <SheetHeader className="mb-4">
                <SheetTitle>{detailJob.company}</SheetTitle>
                <p className="text-sm text-[--color-text-secondary]">{detailJob.position}</p>
              </SheetHeader>
              <div className="space-y-4 text-sm">
                <StatusBadge status={detailJob.status} type="job" />
                <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
                  <div><span className="mb-0.5 block text-[--color-text-muted]">渠道</span><span>{detailJob.channel}</span></div>
                  <div><span className="mb-0.5 block text-[--color-text-muted]">投递日期</span><span className="font-mono">{formatChinaDate(detailJob.appliedAt)}</span></div>
                  <div><span className="mb-0.5 block text-[--color-text-muted]">BASE 地</span><span>{detailJob.baseLocation || "-"}</span></div>
                  <div><span className="mb-0.5 block text-[--color-text-muted]">HR 联系</span><span>{detailJob.hrContact || "-"}</span></div>
                  <div><span className="mb-0.5 block text-[--color-text-muted]">关联面试</span><span className="font-mono">{detailJob._count?.interviews ?? 0} 轮</span></div>
                  {detailJob.link && (
                    <div>
                      <span className="mb-0.5 block text-[--color-text-muted]">投递链接</span>
                      <a href={detailJob.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 whitespace-nowrap text-[--color-link] hover:underline">
                        打开投递页 <ExternalLink size={10} />
                      </a>
                    </div>
                  )}
                </div>
                {detailJob.notes && (
                  <div>
                    <span className="mb-1 block text-xs text-[--color-text-muted]">备注</span>
                    <p className="rounded border border-[--color-border] bg-[--color-bg-hover] p-2 text-sm">{detailJob.notes}</p>
                  </div>
                )}
                <div className="flex gap-2 pt-2">
                  <Button size="sm" variant="outline" onClick={() => openEdit(detailJob)} className="gap-1.5"><Pencil size={13} /> 编辑</Button>
                  <Button size="sm" variant="outline" onClick={() => handleDelete(detailJob.id, true)} className="gap-1.5 text-[--color-danger] hover:text-[--color-danger]"><Trash2 size={13} /> 删除</Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingJob ? "编辑投递记录" : "新建投递记录"}</DialogTitle>
          </DialogHeader>
          <div className="mt-2 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1 block text-xs">公司 *</Label>
                <Input value={form.company} onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))} placeholder="公司名称" className="h-8 text-sm" />
              </div>
              <div>
                <Label className="mb-1 block text-xs">职位 *</Label>
                <Input value={form.position} onChange={(e) => setForm((f) => ({ ...f, position: e.target.value }))} placeholder="职位名称" className="h-8 text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="mb-1 block text-xs">渠道</Label>
                <Select value={form.channel} onValueChange={(v) => setForm((f) => ({ ...f, channel: v }))}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>{JOB_CHANNELS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-1 block text-xs">投递日期</Label>
                <Input type="date" value={form.appliedAt} onChange={(e) => setForm((f) => ({ ...f, appliedAt: e.target.value }))} className="h-8 font-mono text-sm" />
              </div>
              <div>
                <Label className="mb-1 block text-xs">状态</Label>
                <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>{JOB_STATUS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1 block text-xs">BASE 地</Label>
                <Input value={form.baseLocation} onChange={(e) => setForm((f) => ({ ...f, baseLocation: e.target.value }))} placeholder="如：北京、上海、远程" className="h-8 text-sm" />
              </div>
              <div>
                <Label className="mb-1 block text-xs">HR 联系</Label>
                <Input value={form.hrContact} onChange={(e) => setForm((f) => ({ ...f, hrContact: e.target.value }))} placeholder="姓名 / 微信 / 电话" className="h-8 text-sm" />
              </div>
            </div>
            <div>
              <Label className="mb-1 block text-xs">投递链接</Label>
              <Input value={form.link} onChange={(e) => setForm((f) => ({ ...f, link: e.target.value }))} placeholder="https://..." className="h-8 font-mono text-sm" />
            </div>
            <div>
              <Label className="mb-1 block text-xs">备注</Label>
              <Textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="内推人、岗位来源、注意事项..." className="resize-none text-sm" rows={2} />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>取消</Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? "保存中..." : "保存"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
