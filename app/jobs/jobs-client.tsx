"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { Plus, Trash2, Search, X, ExternalLink, Eye, Pencil } from "lucide-react"
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

const STATUS_COLORS: Record<string, string> = {
  "已投递": "#9A9A9A",
  "已回复": "#B8902D",
  "进入面试": "#0969DA",
  "已拒绝": "#A8463A",
  "已Offer": "#3A7D5C",
  "已接受": "#3A7D5C",
  "已放弃": "#D4D1C7",
}

const defaultForm = {
  company: "",
  position: "",
  channel: "Boss直聘",
  appliedAt: new Date().toISOString().slice(0, 10),
  status: "已投递",
  notes: "",
  baseLocation: "",
  hrContact: "",
  link: "",
}

export function JobsClient() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [filterStatus, setFilterStatus] = useState("全部")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [editingJob, setEditingJob] = useState<Job | null>(null)
  const [detailJob, setDetailJob] = useState<Job | null>(null)
  const [form, setForm] = useState(defaultForm)
  const [saving, setSaving] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const params = new URLSearchParams()
        if (search) params.set("q", search)
        if (filterStatus !== "全部") params.set("status", filterStatus)
        const [jobsData, statsData] = await Promise.all([
          apiFetch<Job[]>(`/api/jobs?${params.toString()}&_t=${Date.now()}`),
          apiFetch<Stats>(`/api/jobs/stats?_t=${Date.now()}`),
        ])
        if (!cancelled) {
          setJobs(jobsData)
          setStats(statsData)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [search, filterStatus, refreshKey])

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
      if (editingJob) {
        await apiPatch(`/api/jobs/${editingJob.id}`, body)
      } else {
        await apiPost("/api/jobs", body)
      }
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
    await apiPatch(`/api/jobs/${id}`, { status })
    triggerRefresh()
  }

  const statusDist = stats?.statusDist.map((d) => ({
    ...d,
    color: STATUS_COLORS[d.name] ?? "#9A9A9A",
  })) ?? []

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-10">
      <div className="mb-8">
        <h1 className="text-xl font-semibold mb-1">求职追踪</h1>
        <p className="text-sm text-[--color-text-muted]">记录每一次投递，追踪求职进度</p>
      </div>

      {/* Stats */}
      {stats && (
        <section className="mb-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <StatsCard title="累计投递" value={stats.total} sub="家公司" />
            <StatsCard
              title="回复率"
              value={`${stats.replyRate}%`}
              sub={stats.replyRate > 50 ? "↑ 还不错" : "继续加油"}
              trend={stats.replyRate > 50 ? "up" : "neutral"}
            />
            <StatsCard title="面试转化率" value={`${stats.interviewRate}%`} sub="进入面试" />
            <StatsCard
              title="Offer 率"
              value={`${stats.offerRate}%`}
              trend={stats.offerRate > 0 ? "up" : "neutral"}
            />
          </div>

          {stats.total > 0 && (
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-[--color-bg-surface] border border-[--color-border] rounded-[--radius-lg] p-4">
                <p className="text-xs text-[--color-text-muted] mb-3">按状态分布</p>
                <SimpleBarChart data={statusDist} height={Math.max(120, statusDist.length * 32)} />
              </div>
              <div className="bg-[--color-bg-surface] border border-[--color-border] rounded-[--radius-lg] p-4">
                <p className="text-xs text-[--color-text-muted] mb-3">按渠道分布</p>
                <SimpleBarChart data={stats.channelDist} height={Math.max(120, stats.channelDist.length * 32)} />
              </div>
              {stats.monthlyTrend.length > 1 && (
                <div className="bg-[--color-bg-surface] border border-[--color-border] rounded-[--radius-lg] p-4">
                  <p className="text-xs text-[--color-text-muted] mb-3">按月投递趋势</p>
                  <SimpleLineChart data={stats.monthlyTrend} height={180} />
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[--color-text-muted]" />
          <Input
            placeholder="搜索任意字段，可用空格组合条件..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm border-[--color-border]"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[--color-text-muted] hover:text-[--color-text-primary]">
              <X size={12} />
            </button>
          )}
        </div>

        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="h-8 w-32 text-sm border-[--color-border]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="全部">全部状态</SelectItem>
            {JOB_STATUS.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button size="sm" onClick={openCreate} className="h-8 gap-1.5">
          <Plus size={14} /> 新建记录
        </Button>
      </div>

      {/* Table */}
      <div className="bg-[--color-bg-surface] border border-[--color-border] rounded-[--radius-lg] overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-sm text-[--color-text-muted]">加载中...</div>
        ) : jobs.length === 0 ? (
          <EmptyState
            title="暂无投递记录"
            description="点击右上角「新建记录」开始追踪你的求职进度"
            action={{ label: "新建记录", onClick: openCreate }}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-[--color-border-strong] bg-[--color-bg-hover]">
                  <th className="text-left px-4 py-2.5 font-medium text-xs text-[--color-text-muted] w-[120px]">公司</th>
                  <th className="text-left px-4 py-2.5 font-medium text-xs text-[--color-text-muted]">职位</th>
                  <th className="text-left px-4 py-2.5 font-medium text-xs text-[--color-text-muted] w-[80px]">渠道</th>
                  <th className="text-left px-4 py-2.5 font-medium text-xs text-[--color-text-muted] w-[90px] font-mono">投递日期</th>
                  <th className="text-left px-4 py-2.5 font-medium text-xs text-[--color-text-muted] w-[110px]">状态</th>
                  <th className="text-left px-4 py-2.5 font-medium text-xs text-[--color-text-muted] w-[70px]">BASE</th>
                  <th className="text-left px-4 py-2.5 font-medium text-xs text-[--color-text-muted] w-[90px]">联系人</th>
                  <th className="text-left px-4 py-2.5 font-medium text-xs text-[--color-text-muted] w-[70px] font-mono">面试</th>
                  <th className="text-left px-4 py-2.5 font-medium text-xs text-[--color-text-muted] w-[60px]">链接</th>
                  <th className="text-left px-4 py-2.5 font-medium text-xs text-[--color-text-muted]">备注</th>
                  <th className="px-4 py-2.5 w-[70px]"></th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr
                    key={job.id}
                    className="border-b border-[--color-border] hover:bg-[--color-bg-hover] transition-colors cursor-pointer group"
                    onClick={() => openDetail(job)}
                  >
                    <td className="px-4 py-3 font-medium">{job.company}</td>
                    <td className="px-4 py-3 text-[--color-text-secondary]">{job.position}</td>
                    <td className="px-4 py-3 text-xs text-[--color-text-muted] font-mono">{job.channel}</td>
                    <td className="px-4 py-3 font-mono text-xs text-[--color-text-muted]">
                      {formatChinaDate(job.appliedAt, { month: "2-digit", day: "2-digit" })}
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <Select value={job.status} onValueChange={(v) => handleStatusChange(job.id, v)}>
                        <SelectTrigger className="h-6 border-0 bg-transparent p-0 w-auto gap-1 focus:ring-0 shadow-none">
                          <StatusBadge status={job.status} type="job" />
                        </SelectTrigger>
                        <SelectContent>
                          {JOB_STATUS.map((s) => (
                            <SelectItem key={s} value={s}>{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-4 py-3 text-xs text-[--color-text-muted]">{job.baseLocation || "—"}</td>
                    <td className="px-4 py-3 text-xs text-[--color-text-muted] max-w-[110px] truncate">{job.hrContact || "—"}</td>
                    <td className="px-4 py-3 font-mono text-xs text-center text-[--color-text-muted]">
                      {job._count?.interviews ?? 0}
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      {job.link ? (
                        <a
                          href={job.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-[--color-link] hover:underline flex items-center gap-0.5"
                        >
                          投递 <ExternalLink size={10} />
                        </a>
                      ) : (
                        <span className="text-xs text-[--color-text-muted]">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-[--color-text-muted] max-w-[140px] truncate">
                      {job.notes}
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => openDetail(job)}
                          className="p-1 text-[--color-text-muted] hover:text-[--color-link]"
                          title="查看"
                        >
                          <Eye size={13} />
                        </button>
                        <button
                          onClick={() => openEdit(job)}
                          className="p-1 text-[--color-text-muted] hover:text-[--color-text-primary]"
                          title="编辑"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => handleDelete(job.id)}
                          className="p-1 text-[--color-text-muted] hover:text-[--color-danger]"
                          title="删除"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {jobs.length > 0 && (
        <p className="text-xs text-[--color-text-muted] mt-2 font-mono">{jobs.length} 条记录</p>
      )}

      {/* Detail sheet */}
      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          {detailJob && (
            <>
              <SheetHeader className="mb-4">
                <SheetTitle>{detailJob.company}</SheetTitle>
                <p className="text-sm text-[--color-text-secondary]">{detailJob.position}</p>
              </SheetHeader>
              <div className="space-y-4 text-sm">
                <StatusBadge status={detailJob.status} type="job" />
                <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
                  <div>
                    <span className="text-[--color-text-muted] block mb-0.5">渠道</span>
                    <span>{detailJob.channel}</span>
                  </div>
                  <div>
                    <span className="text-[--color-text-muted] block mb-0.5">投递日期</span>
                    <span className="font-mono">{formatChinaDate(detailJob.appliedAt)}</span>
                  </div>
                  <div>
                    <span className="text-[--color-text-muted] block mb-0.5">BASE 地</span>
                    <span>{detailJob.baseLocation || "—"}</span>
                  </div>
                  <div>
                    <span className="text-[--color-text-muted] block mb-0.5">HR 联系</span>
                    <span>{detailJob.hrContact || "—"}</span>
                  </div>
                  <div>
                    <span className="text-[--color-text-muted] block mb-0.5">关联面试</span>
                    <span className="font-mono">{detailJob._count?.interviews ?? 0} 轮</span>
                  </div>
                  {detailJob.link && (
                    <div>
                      <span className="text-[--color-text-muted] block mb-0.5">投递链接</span>
                      <a
                        href={detailJob.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[--color-link] hover:underline flex items-center gap-0.5"
                      >
                        打开投递页 <ExternalLink size={10} />
                      </a>
                    </div>
                  )}
                </div>
                {detailJob.notes && (
                  <div>
                    <span className="text-[--color-text-muted] text-xs block mb-1">备注</span>
                    <p className="text-sm bg-[--color-bg-hover] rounded p-2 border border-[--color-border]">{detailJob.notes}</p>
                  </div>
                )}
                <div className="flex gap-2 pt-2">
                  <Button size="sm" variant="outline" onClick={() => openEdit(detailJob)} className="gap-1.5">
                    <Pencil size={13} /> 编辑
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleDelete(detailJob.id, true)} className="gap-1.5 text-[--color-danger] hover:text-[--color-danger]">
                    <Trash2 size={13} /> 删除
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Create/Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingJob ? "编辑投递记录" : "新建投递记录"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs mb-1 block">公司 *</Label>
                <Input
                  value={form.company}
                  onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
                  placeholder="公司名称"
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs mb-1 block">职位 *</Label>
                <Input
                  value={form.position}
                  onChange={(e) => setForm((f) => ({ ...f, position: e.target.value }))}
                  placeholder="职位名称"
                  className="h-8 text-sm"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs mb-1 block">渠道</Label>
                <Select value={form.channel} onValueChange={(v) => setForm((f) => ({ ...f, channel: v }))}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {JOB_CHANNELS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs mb-1 block">投递日期</Label>
                <Input
                  type="date"
                  value={form.appliedAt}
                  onChange={(e) => setForm((f) => ({ ...f, appliedAt: e.target.value }))}
                  className="h-8 text-sm font-mono"
                />
              </div>
              <div>
                <Label className="text-xs mb-1 block">状态</Label>
                <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {JOB_STATUS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs mb-1 block">BASE 地</Label>
                <Input
                  value={form.baseLocation}
                  onChange={(e) => setForm((f) => ({ ...f, baseLocation: e.target.value }))}
                  placeholder="如：北京、上海、远程"
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs mb-1 block">HR 联系</Label>
                <Input
                  value={form.hrContact}
                  onChange={(e) => setForm((f) => ({ ...f, hrContact: e.target.value }))}
                  placeholder="姓名 / 微信 / 电话"
                  className="h-8 text-sm"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs mb-1 block">投递链接</Label>
              <Input
                value={form.link}
                onChange={(e) => setForm((f) => ({ ...f, link: e.target.value }))}
                placeholder="https://..."
                className="h-8 text-sm font-mono"
              />
            </div>
            <div>
              <Label className="text-xs mb-1 block">备注</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="内推人、岗位来源、注意事项..."
                className="text-sm resize-none"
                rows={2}
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>取消</Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? "保存中..." : "保存"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
